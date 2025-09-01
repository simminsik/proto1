import React, { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { saveEmployees, getEmployees, clearEmployees } from "../lib/idb";

// 한글/영문 헤더 매핑 → 통일된 키로 저장
const HEADER_MAP = {
  "사번": "employee_id",
  "이름": "name",
  "부서": "department",
  "직책": "title",
  "이메일": "email",
  "연락처": "phone",
  "입사일": "hire_date",
  "급여": "salary",
  "상태": "status",
  "관리자사번": "manager_id",

  // 영문은 그대로 사용
  "employee_id": "employee_id",
  "name": "name",
  "department": "department",
  "title": "title",
  "email": "email",
  "phone": "phone",
  "hire_date": "hire_date",
  "salary": "salary",
  "status": "status",
  "manager_id": "manager_id",
};

function normalizeDate(v) {
  // XLSX에서 Date로 들어오면 YYYY-MM-DD로 변환
  if (v instanceof Date) {
    return v.toISOString().slice(0, 10);
  }
  return v ?? "";
}

function normalizeNumber(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? v : n;
}

function normalizeRow(headers, row) {
  const obj = {
    employee_id: "",
    name: "",
    department: "",
    title: "",
    email: "",
    phone: "",
    hire_date: "",
    salary: null,
    status: "",
    manager_id: null,
  };

  headers.forEach((h, i) => {
    const key = HEADER_MAP[String(h).trim()] || String(h).trim();
    let val = row[i];

    if (key === "hire_date") val = normalizeDate(val);
    if (key === "salary" || key === "employee_id" || key === "manager_id") {
      val = normalizeNumber(val);
    }
    if (key in obj) obj[key] = val ?? obj[key];
  });

  // 필수키 보정
  if (!obj.employee_id) {
    // 사번이 비어있으면 저장 실패 방지 위해 문자열 키 생성 (확인용)
    obj.employee_id = `TEMP_${crypto.randomUUID()}`;
  }
  return obj;
}

export default function ExcelUploaderLocal() {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // 앱 로드 시 IndexedDB에서 기존 데이터 불러오기
    (async () => {
      const data = await getEmployees();
      setRows(data);
      setLoaded(true);
    })();
  }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      // cellDates: true → Date 객체로 읽기
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json2d = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const headers = (json2d[0] || []).map((h) => String(h).trim());
      const body = json2d.slice(1).filter((r) => r.some((v) => v !== undefined && v !== null && v !== ""));

      const normalized = body.map((r) => normalizeRow(headers, r));
      setRows(normalized);
      setMsg(`파일 파싱 완료: ${normalized.length}건`);
    };

    reader.readAsArrayBuffer(file);
  };

  const handleSave = async () => {
    await saveEmployees(rows);
    setMsg(`IndexedDB 저장 완료 (${rows.length}건)`);
  };

  const handleLoad = async () => {
    const data = await getEmployees();
    setRows(data);
    setMsg(`IndexedDB에서 재로딩 (${data.length}건)`);
  };

  const handleClear = async () => {
    await clearEmployees();
    setRows([]);
    setMsg("IndexedDB 비우기 완료");
  };

  return (
    <div>
      <h2>사원정보 엑셀 업로드 (로컬 IndexedDB 저장)</h2>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
      <div style={{ marginTop: 12 }}>
        <button onClick={handleSave} disabled={!rows.length}>로컬DB 저장</button>
        <button onClick={handleLoad} disabled={!loaded}>로컬DB 불러오기</button>
        <button onClick={handleClear}>로컬DB 비우기</button>
      </div>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

      {rows.length > 0 && (
        <table border="1" cellPadding="8" style={{ marginTop: 16, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx}>
                {Object.values(r).map((v, i2) => <td key={i2}>{String(v ?? "")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
