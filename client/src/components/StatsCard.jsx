export default function StatsCard({ label, value, icon }) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white shadow hover:shadow-md transition">
      <div className="text-3xl">{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  );
}