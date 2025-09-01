import React, { useState } from "react";
import * as XLSX from "xlsx";

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
  if (v instanceof Date) return v.toISOString().slice(0, 10);
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

  // 서버 유효성: employee_id 필수라고 가정
  if (!obj.employee_id || typeof obj.employee_id !== "number") {
    throw new Error(`employee_id 누락 또는 숫자 아님: ${JSON.stringify(obj)}`);
  }
  return obj;
}

export default function ExcelUploaderApi() {
  const [rows, setRows] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json2d = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const headers = (json2d[0] || []).map((h) => String(h).trim());
        const body = json2d.slice(1).filter((r) => r.some((v) => v !== undefined && v !== null && v !== ""));

        const normalized = body.map((r) => normalizeRow(headers, r));
        setRows(normalized);
        setMsg(`파일 파싱 완료: ${normalized.length}건`);
      } catch (err) {
        console.error(err);
        setMsg(`파싱 오류: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  const sendToServer = async () => {
    if (!rows.length) return;
    setLoading(true);
    setMsg("서버 전송 중...");

    try {
      const res = await fetch("/api/employees/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // 세션/쿠키 사용시
        body: JSON.stringify({ employees: rows }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const result = await res.json(); // { created: n, updated: m, errors: [] }와 같은 포맷 가정
      setMsg(`업로드 완료: 생성 ${result.created ?? 0}건, 수정 ${result.updated ?? 0}건`);
    } catch (err) {
      console.error(err);
      setMsg(`업로드 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>사원정보 엑셀 업로드 (서버 연동)</h2>
      <input type="file" accept=".xlsx,.xls" onChange={handleFile} />
      <div style={{ marginTop: 12 }}>
        <button onClick={sendToServer} disabled={!rows.length || loading}>
          {loading ? "전송 중..." : "서버로 전송"}
        </button>
      </div>
      {msg && <p style={{ marginTop: 8 }}>{msg}</p>}

      {rows.length > 0 && (
        <table border="1" cellPadding="8" style={{ marginTop: 16, borderCollapse: "collapse" }}>
          <thead>
            <tr>{Object.keys(rows[0]).map((k) => <th key={k}>{k}</th>)}</tr>
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
