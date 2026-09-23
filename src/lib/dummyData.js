export function getDummyStatus() {
    return {
        status: "STERIL.",
        t1: 47.4, t2: 49.0, t3: 49.6, t4: 48.0, t5: 51.1, t6: 47.0,
        th: 121.0, tm: 121.0, tl: 120.8,
        p1: -1, p2: 0,
        running: true,
        updatedAt: new Date().toISOString(),
    };
}

export function getDummyFormulas() {
    return [
        {
            formulaNo: "121",
            controlTemp: 121.0,
            spaceTemp: 0.6,
            sterilTemp: 121.0,
            sterilTime: 15,
            alarmPres: 240,
            coolingTemp1: 100.0,
            coolingTemp2: 55.0,
            foValSetting: 6.0,
            controlType: "Time",
            sterilMaterial: "Soft bottle",
        },
        {
            formulaNo: "115",
            controlTemp: 115.0,
            spaceTemp: 0.5,
            sterilTemp: 115.0,
            sterilTime: 20,
            alarmPres: 200,
            coolingTemp1: 95.0,
            coolingTemp2: 50.0,
            foValSetting: 5.0,
            controlType: "Level",
            sterilMaterial: "Hard bottle",
        },
        {
            formulaNo: "134",
            controlTemp: 134.0,
            spaceTemp: 0.8,
            sterilTemp: 134.0,
            sterilTime: 4,
            alarmPres: 310,
            coolingTemp1: 110.0,
            coolingTemp2: 60.0,
            foValSetting: 8.0,
            controlType: "Time",
            sterilMaterial: "Hard bottle",
        },
    ];
}