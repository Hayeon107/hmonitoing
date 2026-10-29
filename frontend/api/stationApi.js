const API_URL = "http://127.0.0.1:8001/api/stations";

export async function getStations() {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error(`서버 응답 오류: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("API 응답이 목록 형식이 아닙니다.");
  }

  return data;
}