"use client";

export default function PrintToolbar({ testId }: { testId: string }) {
  return (
    <div
      className="no-print"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 700 }}>BioMonk</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Print / Save as PDF
          </button>
          <a
            href={`/tests/${testId}/result`}
            style={{
              border: "1px solid #e5e7eb",
              background: "#fff",
              color: "#111",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Back
          </a>
        </div>
      </div>
    </div>
  );
}

