import { useState } from "react"
import type { ReactNode } from "react"
import { Button, Checkbox, Popover } from "antd"
import { FilterFilled } from "@ant-design/icons"

interface ColumnFilterProps<T extends string> {
  label: string
  options: readonly T[]
  /** Empty means no filter: every value is shown. */
  selected: T[]
  onChange: (values: T[]) => void
  renderOption?: (value: T) => ReactNode
}

// A column header that opens a checklist. Each tick applies straight away, so the table
// and summary update while the popover stays open for further changes.
export const ColumnFilter = <T extends string>({ label, options, selected, onChange, renderOption }: ColumnFilterProps<T>) => {
  const [open, setOpen] = useState(false)
  const active = selected.length > 0

  const content = (
    <div className="column-filter">
      <Checkbox.Group
        className="column-filter-options"
        value={selected}
        // Keep canonical order regardless of click order, so the URL is stable.
        onChange={(values) => onChange(options.filter((o) => values.includes(o)))}
        options={options.map((value) => ({ value, label: renderOption ? renderOption(value) : value }))}
      />
      <div className="column-filter-footer">
        <span className="column-filter-hint">{active ? `${selected.length} of ${options.length}` : "None selected shows all"}</span>
        <Button size="small" type="link" disabled={!active} onClick={() => onChange([])}>
          Reset
        </Button>
      </div>
    </div>
  )

  return (
    <Popover trigger="click" placement="bottomLeft" open={open} onOpenChange={setOpen} content={content}>
      <button
        type="button"
        className={`sort-header${active ? " active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Filter by ${label.toLowerCase()}${active ? `, ${selected.length} selected` : ""}`}
      >
        {label}
        {active && <span className="filter-count">{selected.length}</span>}
        <FilterFilled className={`filter-icon${active ? " active" : ""}`} aria-hidden />
      </button>
    </Popover>
  )
}
