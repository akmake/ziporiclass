import { useState } from 'react';

/* ── DatePicker ── */
function DatePicker({ label, value = '', onChange }) {
  const [val, setVal] = useState(value);

  const handle = (e) => {
    setVal(e.target.value);
    onChange?.(e.target.value);
  };

  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 rtl">
      {label}
      <input
        type="date"
        value={val}
        onChange={handle}
        className="rounded border px-2 py-1"
      />
    </label>
  );
}

export default DatePicker;            // import DatePicker from ...
export { DatePicker };                // import { DatePicker } ...
