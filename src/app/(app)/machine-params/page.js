"use client";

import PermissionGate from "@/components/PermissionGate";
import PlcParamEditor from "@/components/PlcParamEditor";

export default function MachineParamsPage() {
    return (
        <PermissionGate resource="machine_params" minLevel="view">
            <PlcParamEditor
                title="Parameter Mesin"
                subtitle="Super Water Sterilizer — Parameter Setting 1 & 2 dan Pressure Coefficient (baca dan ubah nilai PLC)"
                groups={["param1", "param2", "coef"]}
            />
        </PermissionGate>
    );
}
