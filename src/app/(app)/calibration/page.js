"use client";

import PermissionGate from "@/components/PermissionGate";
import PlcParamEditor from "@/components/PlcParamEditor";

export default function CalibrationPage() {
    return (
        <PermissionGate resource="calibration" minLevel="view">
            <PlcParamEditor
                title="Kalibrasi"
                subtitle="Super Water Sterilizer — offset kalibrasi sensor (bertanda, ditambahkan ke nilai sensor di PLC)"
                groups={["calibration"]}
            />
        </PermissionGate>
    );
}
