
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text

from database import engine, test_connection

app = FastAPI(title="수소충전소 운영정보")

# 개발용 설정: Live Server에서 접속할 수 있도록 허용
# 실제 배포 시에는 실제 프론트엔드 주소만 허용하도록 변경해야 함
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "PUT", "POST", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class StationUpdate(BaseModel):
    station_name: str | None = None
    operator: str | None = None
    address: str | None = None
    monitoring_installed: str | None = None
    modbus_working: str | None = None
    communication_error: str | None = None
    srp: str | None = None
    blue: str | None = None
    ip: str | None = None
    port: int | None = None
    matrix_installed: str | None = None
    latest_history: str | None = None
    past_history: str | None = None


class StationHistoryCreate(BaseModel):
    content: str


class StationHistoryUpdate(BaseModel):
    content: str
    


EDITABLE_FIELDS = {
    "station_name",
    "operator",
    "address",
    "monitoring_installed",
    "modbus_working",
    "communication_error",
    "srp",
    "blue",
    "ip",
    "port",
    "matrix_installed",
    "latest_history",
    "past_history",
}

@app.get("/")
def home():
    return {
        "message": "수소충전소 운영정보 API가 정상적으로 실행 중입니다.",
        "stations": "/api/stations",
        "api_docs": "/docs"
    }


@app.get("/api/health")
def health_check():
    try:
        result = test_connection()
        return {
            "status": "ok",
            "database": "connected",
            "test_result": result,
        }
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="데이터베이스 연결에 실패했습니다.",
        )




@app.get("/api/stations")
def get_stations():
    try:
        with engine.connect() as connection:
            result = connection.execute(
                text("""
                    SELECT
                        station_no,
                        station_name,
                        operator,
                        address,
                        monitoring_installed,
                        modbus_working,
                        communication_error,
                        srp,
                        blue,
                        ip,
                        port,
                        matrix_installed,
                        latest_history,
                        past_history,
                        updated_at
                    FROM hydrogen_stations
                    ORDER BY station_no
                """)
            )
            return [
                dict(row)
                for row in result.mappings().all()
            ]
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="충전소 목록 조회에 실패했습니다.",
        )


@app.put("/api/stations/{station_no}")
def update_station(
    station_no: int,
    payload: StationUpdate,
):
    values = payload.model_dump(exclude_unset=True)

    # station_no를 제외한 수정 가능 필드만 처리
    values = {
        key: value
        for key, value in values.items()
        if key in EDITABLE_FIELDS
    }

    if not values:
        raise HTTPException(
            status_code=400,
            detail="수정할 항목이 없습니다.",
        )

    # 사용자가 직접 입력한 빈 문자열은 빈 문자열로 보존
    assignments = [
        f"{key} = :{key}"
        for key in values
    ]
    assignments.append("updated_at = :updated_at")
    values["updated_at"] = datetime.now(timezone.utc)
    values["station_no"] = station_no

    sql = text(
        "UPDATE hydrogen_stations SET "
        + ", ".join(assignments)
        + " WHERE station_no = :station_no"
    )

    try:
        with engine.begin() as connection:
            result = connection.execute(sql, values)

            if result.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail="해당 충전소 번호를 찾을 수 없습니다.",
                )

            row = connection.execute(
                text("""
                    SELECT *
                    FROM hydrogen_stations
                    WHERE station_no = :station_no
                """),
                {"station_no": station_no},
            ).mappings().one()

            return dict(row)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="충전소 정보 저장에 실패했습니다.",
        )
@app.get("/api/stations/{station_no}/history")
def get_station_history(station_no: int):
    try:
        with engine.connect() as connection:
            # 충전소 존재 여부 확인
            station = connection.execute(
                text("""
                    SELECT station_no
                    FROM hydrogen_stations
                    WHERE station_no = :station_no
                """),
                {"station_no": station_no},
            ).first()

            if station is None:
                raise HTTPException(
                    status_code=404,
                    detail="해당 충전소를 찾을 수 없습니다.",
                )

            result = connection.execute(
                text("""
                    SELECT history_id, station_no, content, created_at
                    FROM station_history
                    WHERE station_no = :station_no
                    ORDER BY created_at DESC, history_id ASC
                """),
                {"station_no": station_no},
            )

            return [dict(row) for row in result.mappings().all()]

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="충전소 이력 조회에 실패했습니다.",
        )


@app.put("/api/stations/{station_no}/history/{history_id}")
def update_station_history(
    station_no: int,
    history_id: int,
    payload: StationHistoryUpdate,
):
    content = payload.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="이력 내용을 입력해 주세요.",
        )

    try:
        with engine.begin() as connection:
            result = connection.execute(
                text("""
                    UPDATE station_history
                    SET content = :content
                    WHERE history_id = :history_id
                      AND station_no = :station_no
                    RETURNING history_id, station_no, content, created_at
                """),
                {
                    "content": content,
                    "history_id": history_id,
                    "station_no": station_no,
                },
            )

            row = result.mappings().first()

            if row is None:
                # 충전소/이력 ID가 잘못됐거나 해당 충전소 소속 이력이 아님
                station = connection.execute(
                    text("""
                        SELECT station_no
                        FROM hydrogen_stations
                        WHERE station_no = :station_no
                    """),
                    {"station_no": station_no},
                ).first()

                if station is None:
                    raise HTTPException(
                        status_code=404,
                        detail="해당 충전소를 찾을 수 없습니다.",
                    )

                raise HTTPException(
                    status_code=404,
                    detail="해당 충전소의 이력을 찾을 수 없습니다.",
                )

            return dict(row)

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="충전소 이력 수정에 실패했습니다.",
        )


@app.post("/api/stations/{station_no}/history", status_code=201)
def create_station_history(
    station_no: int,
    payload: StationHistoryCreate,
):
    content = payload.content.strip()

    if not content:
        raise HTTPException(
            status_code=400,
            detail="이력 내용을 입력해 주세요.",
        )

    try:
        with engine.begin() as connection:
            station = connection.execute(
                text("""
                    SELECT station_no
                    FROM hydrogen_stations
                    WHERE station_no = :station_no
                """),
                {"station_no": station_no},
            ).first()

            if station is None:
                raise HTTPException(
                    status_code=404,
                    detail="해당 충전소를 찾을 수 없습니다.",
                )

            result = connection.execute(
                text("""
                    INSERT INTO station_history (
                        station_no,
                        content
                    )
                    VALUES (
                        :station_no,
                        :content
                    )
                    RETURNING
                        history_id,
                        station_no,
                        content,
                        created_at
                """),
                {
                    "station_no": station_no,
                    "content": content,
                },
            )

            return dict(result.mappings().one())

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="충전소 이력 저장에 실패했습니다.",
        )