
const API_URL = "http://127.0.0.1:8000/api/stations";
import { getStations } from "./api/stationApi.js";

let stations = [];
let currentStation = null;
let editing = false;

const $ = (id) => document.getElementById(id);

const fields = [
    //["station_no", "No", "readonly"],
    //["station_name", "충전소명"],
    ["operator", "운영기관"],
    ["srp", "SRP"],
    ["blue", "BLUE"],
    ["ip", "IP"],
    ["port", "PORT", "number"],
    //["address", "주소", "textarea"],
    ["monitoring_installed", "모니터링 설치"],
    //["modbus_working", "모드버스 작동여부"],
    ["communication_error", "통신장애 여부"],
    ["matrix_installed", "매트릭 설치"],
    ["updated_at", "마지막 수정 시각", "readonly"]
];

function valueOf(value) {
    return value === null || value === undefined
        ? ""
        : String(value);
}

function isCommunicationError(value) {
    const v = valueOf(value).trim().toLowerCase();

    if (!v) return null;

    if (
        v.includes("통신장애") ||
        v.includes("장애 발생") ||
        v === "error"
    ) return true;

    if (
        v === "없음" ||
        v === "정상" ||
        v === "false" ||
        v === "no"
    ) return false;

    return null;
}

function renderStations() {
    const query = $("searchInput").value.trim().toLowerCase();
    const filter = $("statusFilter").value;
    const list = $("stationList");

    list.replaceChildren();

    const filtered = stations.filter((station) => {
        const searchable = [
            station.station_no,
            station.station_name,
            station.operator,
            station.address,
            station.ip,
            station.srp,
            station.blue
        ]
            .map((value) => valueOf(value).toLowerCase())
            .join(" ");

        if (!searchable.includes(query)) return false;

        const error = isCommunicationError(
            station.communication_error
        );

        if (filter === "error" && error !== true) return false;
        if (filter === "normal" && error !== false) return false;
        if (filter === "unknown" && error !== null) return false;

        return true;
    });

    $("totalCount").textContent = stations.length;
    $("resultCount").textContent = filtered.length;

    for (const station of filtered) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "station-card";

        card.setAttribute(
            "aria-label",
            `${valueOf(station.station_no)}번 ${valueOf(station.station_name)} 상세정보 보기`
        );

        const no = document.createElement("div");
        no.className = "station-no";
        no.textContent = valueOf(station.station_no);

        const info = document.createElement("div");
        info.className = "station-info";

        const heading = document.createElement("div");
        heading.className = "station-heading";

        const name = document.createElement("span");
        name.className = "station-name";
        name.textContent =
            valueOf(station.station_name) || "(충전소명 없음)";

        const operator = document.createElement("span");
        operator.className = "station-operator";
        operator.textContent = station.operator
            ? `(${station.operator})`
            : "";

        heading.append(name, operator);

        const address = document.createElement("div");
        address.className = "station-address";
        address.textContent =
            valueOf(station.address) || "주소 미등록";

        info.append(heading, address);
        card.append(no, info);

        card.addEventListener("click", () => openDetails(station));
        list.append(card);
    }

    $("message").textContent = filtered.length
        ? `${filtered.length}개 충전소`
        : "검색 결과가 없습니다.";
}

function openDetails(station) {
    currentStation = station;
    editing = false;

    renderDetails();
    $("saveMessage").textContent = "";
    $("detailDialog").showModal();
}



function renderDetails() {
    if (!currentStation) return;

    const station = currentStation;
    const content = $("detailContent");

    $("detailTitle").textContent =
        `${valueOf(station.station_no)} | ${valueOf(station.station_name) || "충전소 상세정보"}`;

    $("detailAddress").textContent = valueOf(station.address);

    content.replaceChildren();


    // 상세정보 / 이력관리 탭
    const tabs = document.createElement("div");
    tabs.className = "detail-tabs";
    tabs.innerHTML = `
    <button type="button" class="detail-tab active" data-tab="info">
      상세정보
    </button>
    <button type="button" class="detail-tab" data-tab="history">
      이력관리
    </button>
  `;
    content.append(tabs);

    const infoPanel = document.createElement("div");
    infoPanel.id = "infoTabPanel";
    infoPanel.className = "detail-tab-panel";
    content.append(infoPanel);

    const historyPanel = document.createElement("div");
    historyPanel.id = "historyTabPanel";
    historyPanel.className = "detail-tab-panel";
    historyPanel.hidden = true;
    content.append(historyPanel);


    for (const [key, label, type] of fields) {
        const row = document.createElement("div");
        row.className = "detail-row";

        const title = document.createElement("div");
        title.className = "detail-label";
        title.textContent = label;

        let valueElement;

        if (!editing || type === "readonly") {
            valueElement = document.createElement("div");
            valueElement.className = "detail-value";

            let value = station[key];

            if (key === "updated_at" && value) {
                const date = new Date(value);

                if (!Number.isNaN(date.getTime())) {
                    value = date.toLocaleString("ko-KR");
                }
            }

            valueElement.textContent = valueOf(value) || "—";
        } else {
            valueElement = type === "textarea"
                ? document.createElement("textarea")
                : document.createElement("input");

            valueElement.id = `field-${key}`;
            valueElement.name = key;
            valueElement.value = valueOf(station[key]);

            if (type === "number") {
                valueElement.type = "number";
                valueElement.min = "0";
                valueElement.max = "65535";
                valueElement.step = "1";
            }
        }

        row.append(title, valueElement);
        infoPanel.append(row);
    }



    tabs.querySelectorAll(".detail-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            const showHistory = tab.dataset.tab === "history";

            infoPanel.hidden = showHistory;
            historyPanel.hidden = !showHistory;

            // 충전소 정보 수정 버튼은 상세정보 탭에서만 표시
            $("editButton").hidden = showHistory || editing;
            $("saveButton").hidden = showHistory || !editing;
            $("cancelButton").hidden = showHistory || !editing;

            tabs.querySelectorAll(".detail-tab").forEach((item) => {
                item.classList.toggle("active", item === tab);
            });

            if (showHistory) {
                renderHistoryTab();
                loadStationHistory(currentStation.station_no);
            }
        });
    });


    $("editButton").hidden = editing;
    $("saveButton").hidden = !editing;
    $("cancelButton").hidden = !editing;
}



function renderHistoryTab() {
    const historyPanel = $("historyTabPanel");
    if (!historyPanel) return;

    historyPanel.replaceChildren();

    const historySection = document.createElement("section");
    historySection.className = "history-section";
    historySection.innerHTML = `
      <div class="history-header">
        <div>
          <h3>이력 관리</h3>
          <p id="historyCount" class="history-count">이력을 불러오는 중입니다.</p>
        </div>
        <button type="button" id="addHistoryButton" class="button primary">+ 이력 추가</button>
      </div>
      <div id="historyFormArea" hidden>
        <label class="history-input-label" for="newHistoryContent">새 이력 내용</label>
        <textarea id="newHistoryContent" rows="4" maxlength="10000"
          placeholder="점검 내용, 장애 원인, 조치 결과 등을 입력하세요."></textarea>
        <div class="history-form-actions">
          <button type="button" id="cancelHistoryButton" class="button secondary">취소</button>
          <button type="button" id="saveHistoryButton" class="button primary">이력 등록</button>
        </div>
        <p id="historyFormMessage" class="message" role="status"></p>
      </div>
      <div id="historyTimeline" class="history-timeline"></div>
    `;
    historyPanel.append(historySection);

    $("addHistoryButton").addEventListener("click", () => {
        $("historyFormArea").hidden = false;
        $("newHistoryContent").focus();
    });

    $("cancelHistoryButton").addEventListener("click", () => {
        $("newHistoryContent").value = "";
        $("historyFormMessage").textContent = "";
        $("historyFormArea").hidden = true;
    });

    $("saveHistoryButton").addEventListener("click", saveStationHistory);
}

function getEditedValues() {
    const values = {};

    for (const [key, , type] of fields) {
        if (type === "readonly") continue;

        const input = $(`field-${key}`);
        const raw = input.value;

        if (key === "port") {
            if (raw.trim() === "") {
                values[key] = null;
            } else {
                const port = Number(raw);

                if (
                    !Number.isInteger(port) ||
                    port < 0 ||
                    port > 65535
                ) {
                    throw new Error(
                        "PORT는 0~65535 사이의 정수로 입력해 주세요."
                    );
                }

                values[key] = port;
            }
        } else {
            values[key] = raw;
        }
    }

    return values;
}

async function saveStation(event) {
    event.preventDefault();

    if (!editing || !currentStation) return;

    let values;

    try {
        values = getEditedValues();
    } catch (error) {
        $("saveMessage").textContent = error.message;
        return;
    }

    $("saveButton").disabled = true;
    $("saveMessage").textContent = "저장 중입니다.";

    const stationNo = currentStation.station_no;

    try {
        const response = await fetch(
            `${API_URL}/${encodeURIComponent(stationNo)}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(values)
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.detail || `저장 실패 (${response.status})`
            );
        }

        await loadStations();

        currentStation = stations.find(
            (station) =>
                String(station.station_no) === String(stationNo)
        );

        if (!currentStation) {
            throw new Error("저장 후 충전소 정보를 찾을 수 없습니다.");
        }

        editing = false;
        renderDetails();
        $("saveMessage").textContent = "변경사항을 저장했습니다.";
    } catch (error) {
        console.error(error);
        $("saveMessage").textContent =
            `저장 실패: ${error.message}`;
    } finally {
        $("saveButton").disabled = false;
    }
}

async function loadStationHistory(stationNo) {
    const timeline = $("historyTimeline");
    const count = $("historyCount");

    if (!timeline || !count) return;

    timeline.replaceChildren();
    count.textContent = "이력을 불러오는 중입니다.";

    try {
        const response = await fetch(
            `${API_URL}/${encodeURIComponent(stationNo)}/history`
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                data.detail || `이력 조회 실패 (${response.status})`
            );
        }

        if (!Array.isArray(data)) {
            throw new Error("이력 응답 형식이 올바르지 않습니다.");
        }

        count.textContent = `총 ${data.length}건`;

        if (data.length === 0) {
            const empty = document.createElement("p");
            empty.className = "history-empty";
            empty.textContent =
                "등록된 이력이 없습니다. 첫 이력을 추가해 보세요.";

            timeline.append(empty);
            return;
        }

        for (const item of data) {
            const entry = document.createElement("article");
            entry.className = "history-entry";

            const date = document.createElement("time");
            date.className = "history-date";
            date.textContent = formatDate(item.created_at);

            if (item.created_at) {
                date.dateTime = item.created_at;
            }

            const content = document.createElement("p");
            content.className = "history-content";
            content.textContent = valueOf(item.content);

            const actions = document.createElement("div");
            actions.className = "history-form-actions";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "button secondary";
            editButton.textContent = "수정";

            editButton.addEventListener("click", () => {
                const editor = document.createElement("textarea");
                editor.rows = 4;
                editor.maxLength = 10000;
                editor.value = valueOf(item.content);
                editor.className = "history-edit-input";

                const message = document.createElement("p");
                message.className = "message";
                message.setAttribute("role", "status");

                const saveButton = document.createElement("button");
                saveButton.type = "button";
                saveButton.className = "button primary";
                saveButton.textContent = "저장";

                const cancelButton = document.createElement("button");
                cancelButton.type = "button";
                cancelButton.className = "button secondary";
                cancelButton.textContent = "취소";

                const editorActions = document.createElement("div");
                editorActions.className = "history-form-actions";
                editorActions.append(saveButton, cancelButton);

                const editorArea = document.createElement("div");
                editorArea.className = "history-edit-area";
                editorArea.append(editor, editorActions, message);

                content.hidden = true;
                actions.hidden = true;
                entry.append(editorArea);
                editor.focus();

                cancelButton.addEventListener("click", () => {
                    editorArea.remove();
                    content.hidden = false;
                    actions.hidden = false;
                });

                saveButton.addEventListener("click", async () => {
                    const updatedContent = editor.value.trim();
                    if (!updatedContent) {
                        message.textContent = "이력 내용을 입력해 주세요.";
                        return;
                    }
                    if (!item.history_id) {
                        message.textContent = "이력 ID가 없어 수정할 수 없습니다.";
                        return;
                    }

                    saveButton.disabled = true;
                    message.textContent = "저장 중입니다.";

                    try {
                        const response = await fetch(
                            `${API_URL}/${encodeURIComponent(stationNo)}/history/${encodeURIComponent(item.history_id)}`,
                            {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ content: updatedContent })
                            }
                        );
                        const result = await response.json().catch(() => ({}));
                        if (!response.ok) {
                            throw new Error(result.detail || `이력 수정 실패 (${response.status})`);
                        }
                        await loadStationHistory(stationNo);
                    } catch (error) {
                        console.error(error);
                        message.textContent = `수정 실패: ${error.message}`;
                        saveButton.disabled = false;
                    }
                });
            });

            actions.append(editButton);
            entry.append(date, content, actions);
            timeline.append(entry);
        }
    } catch (error) {
        console.error(error);

        count.textContent = "이력 조회 실패";

        const message = document.createElement("p");
        message.className = "history-empty";
        message.textContent = error.message;

        timeline.append(message);
    }
}

function formatDate(value) {
    if (!value) return "날짜 미상";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
        ? valueOf(value)
        : date.toLocaleString("ko-KR", { hour12: false });
}

async function saveStationHistory() {
    if (!currentStation) return;

    const content = $("newHistoryContent").value.trim();
    const message = $("historyFormMessage");
    const button = $("saveHistoryButton");

    if (!content) {
        message.textContent = "이력 내용을 입력해 주세요.";
        return;
    }

    button.disabled = true;
    message.textContent = "등록 중입니다.";

    try {
        const response = await fetch(
            `${API_URL}/${encodeURIComponent(currentStation.station_no)}/history`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ content })
            }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(
                result.detail || `이력 등록 실패 (${response.status})`
            );
        }

        $("newHistoryContent").value = "";
        $("historyFormArea").hidden = true;
        message.textContent = "이력을 등록했습니다.";

        await loadStationHistory(currentStation.station_no);
    } catch (error) {
        console.error(error);
        message.textContent = `등록 실패: ${error.message}`;
    } finally {
        button.disabled = false;
    }
}

async function loadStations() {
    $("refreshButton").disabled = true;

    try {
        stations = await getStations();
        renderStations();
    } catch (error) {
        console.error(error);
        $("message").textContent =
            `데이터를 불러오지 못했습니다: ${error.message}`;
    } finally {
        $("refreshButton").disabled = false;
    }
}

$("searchInput").addEventListener("input", renderStations);
$("statusFilter").addEventListener("change", renderStations);
$("refreshButton").addEventListener("click", loadStations);

$("editButton").addEventListener("click", () => {
    if (!currentStation) return;

    editing = true;
    $("saveMessage").textContent = "";
    renderDetails();
});

$("cancelButton").addEventListener("click", () => {
    editing = false;
    $("saveMessage").textContent = "";
    renderDetails();
});

$("editForm").addEventListener("submit", saveStation);

$("closeDialog").addEventListener("click", () => {
    $("detailDialog").close();
});

$("detailDialog").addEventListener("close", () => {
    editing = false;
});

loadStations();
