interface CheckboxCellProps {
  value?: boolean
  onChange: (value: boolean) => void
  readOnly?: boolean
}

export default function CheckboxCell({ value, onChange, readOnly }: CheckboxCellProps) {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <input
        type="checkbox"
        checked={!!value}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
      />
    </div>
  )
}
