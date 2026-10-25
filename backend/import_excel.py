
from pathlib import Path

import pandas as pd
from sqlalchemy import text

from database import engine


# 엑셀 파일 경로를 지정하세요.
EXCEL_PATH = Path(r"C:\monitoring-update\monitoring_current_situation.xlsx")

COLUMN_MAP = {
    "No": "station_no",
    "충전소명": "station_name",
    "운영기관": "operator",
    "주소": "address",
    "모니터링 설치": "monitoring_installed",
    "모드버스 작동여부": "modbus_working",
    "통신장애 여부 (26.10.16)": "communication_error",
    "SRP": "srp",
    "BLUE": "blue",
    "IP": "ip",
    "PORT": "port",
    "매트릭 설치": "matrix_installed",
    "최신이력": "latest_history",
    "과거이력 / 기타": "past_history",
}

INSERT_SQL = text("""
    INSERT INTO hydrogen_stations (
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
        past_history
    )
    VALUES (
        :station_no,
        :station_name,
        :operator,
        :address,
        :monitoring_installed,
        :modbus_working,
        :communication_error,
        :srp,
        :blue,
        :ip,
        :port,
        :matrix_installed,
        :latest_history,
        :past_history
    )
    ON CONFLICT (station_no) DO NOTHING
""")


def clean_text(value):
    if pd.isna(value):
        return None
    return str(value).strip() or None


def main():
    if not EXCEL_PATH.exists():
        raise FileNotFoundError(
            f"엑셀 파일을 찾을 수 없습니다: {EXCEL_PATH}"
        )

    df = pd.read_excel(EXCEL_PATH, dtype=object)

    # 헤더 앞뒤 공백 제거
    df.columns = [str(c).strip() for c in df.columns]

    missing = set(COLUMN_MAP) - set(df.columns)
    if missing:
        raise ValueError(
            f"엑셀에서 필요한 컬럼을 찾을 수 없습니다: {missing}\n"
            f"실제 컬럼: {list(df.columns)}"
        )

    df = df[list(COLUMN_MAP)].rename(columns=COLUMN_MAP)

    records = []
    invalid_rows = 0

    for row in df.to_dict(orient="records"):
        no_value = row["station_no"]

        if pd.isna(no_value):
            invalid_rows += 1
            continue

        try:
            station_no = int(float(str(no_value).strip()))
        except (ValueError, TypeError):
            invalid_rows += 1
            continue

        record = {"station_no": station_no}

        for col in COLUMN_MAP.values():
            if col == "station_no":
                continue
            elif col == "port":
                value = row[col]
                if pd.isna(value) or str(value).strip() == "":
                    record[col] = None
                else:
                    try:
                        record[col] = int(float(str(value).strip()))
                    except (ValueError, TypeError):
                        record[col] = None
            else:
                record[col] = clean_text(row[col])

        records.append(record)

    inserted = 0
    skipped = 0

    # 전체 가져오기를 하나의 트랜잭션으로 처리
    with engine.begin() as connection:
        for record in records:
            result = connection.execute(INSERT_SQL, record)
            if result.rowcount == 1:
                inserted += 1
            else:
                skipped += 1

    print(f"가져오기 완료")
    print(f"추가된 행: {inserted}")
    print(f"기존 번호로 건너뛴 행: {skipped}")
    print(f"No가 비어 있거나 유효하지 않아 제외한 행: {invalid_rows}")


if __name__ == "__main__":
    main()
