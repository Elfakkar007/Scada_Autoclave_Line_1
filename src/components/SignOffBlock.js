export default function SignOffBlock({ style = {}, className = "", columnWidth = 260 }) {
    return (
        <div
            className={`keep-together ${className}`}
            style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 24,
                paddingTop: 8,
                fontSize: 11,
                color: "#000",
                breakInside: "avoid",
                pageBreakInside: "avoid",
                ...style,
            }}
        >
            {/* Kolom Kiri: Operated by + DATE */}
            <div style={{ width: columnWidth }}>
                <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 12 }}>
                    <span style={{ whiteSpace: "nowrap", paddingRight: 4 }}>Operated by:</span>
                    <span style={{ flex: 1, borderBottom: "1px solid #000", marginBottom: 2 }} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <span style={{ whiteSpace: "nowrap", paddingRight: 4 }}>DATE:</span>
                    <span style={{ flex: 1, borderBottom: "1px solid #000", marginBottom: 2 }} />
                </div>
            </div>

            {/* Kolom Kanan: Checked by + DATE */}
            <div style={{ width: columnWidth }}>
                <div style={{ display: "flex", alignItems: "flex-end", marginBottom: 12 }}>
                    <span style={{ whiteSpace: "nowrap", paddingRight: 4 }}>Checked by:</span>
                    <span style={{ flex: 1, borderBottom: "1px solid #000", marginBottom: 2 }} />
                </div>
                <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <span style={{ whiteSpace: "nowrap", paddingRight: 4 }}>DATE:</span>
                    <span style={{ flex: 1, borderBottom: "1px solid #000", marginBottom: 2 }} />
                </div>
            </div>
        </div>
    );
}

