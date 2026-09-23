export default function StatCard({ label, value, unit }) {
    return (
        <div className="bg-slate-800 rounded-lg p-4 text-center">
            <div className="text-xs text-slate-400 uppercase">{label}</div>
            <div className="text-xl font-bold">
                {value}
                {unit}
            </div>
        </div>
    );
}