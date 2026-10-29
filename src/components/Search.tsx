import { useId, useState } from "react";
import { Search as SearchIcon, TrainFront, BusFront } from "lucide-react";
import { searchStops } from "../data/utils";
import { operators } from "../data/types";
import type { Stop } from "../data/types";
export default function Search({
  stops,
  value,
  onChange,
  label,
  placeholder = "Zoek een halte of station",
}: {
  stops: Stop[];
  value: Stop | null;
  onChange: (s: Stop | null) => void;
  label: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState(""),
    [open, setOpen] = useState(false),
    [index, setIndex] = useState(0);
  const id = useId();
  const results = searchStops(stops, q);
  function choose(s: Stop) {
    onChange(s);
    setQ("");
    setOpen(false);
  }
  return (
    <div className="search-field">
      <label htmlFor={id}>{label}</label>
      <div className="search-input">
        <SearchIcon size={18} />
        <input
          id={id}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={id + "list"}
          aria-activedescendant={
            open && results[index] ? id + index : undefined
          }
          placeholder={placeholder}
          value={open ? q : value?.name || q}
          onFocus={() => {
            setOpen(true);
            setQ(value?.name || "");
            setIndex(0);
          }}
          onChange={(e) => {
            setQ(e.target.value);
            onChange(null);
            setIndex(0);
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(i + 1, results.length - 1));
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(i - 1, 0));
            }
            if (e.key === "Enter" && open && results[index]) {
              e.preventDefault();
              choose(results[index]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {value && (
          <button
            type="button"
            className="clear"
            aria-label={`${label} wissen`}
            onClick={() => {
              onChange(null);
              setQ("");
            }}
          >
            ×
          </button>
        )}
      </div>
      {open && (
        <div className="suggestions" role="listbox" id={id + "list"}>
          {results.map((s, i) => (
            <button
              type="button"
              id={id + i}
              role="option"
              aria-selected={index === i}
              className={index === i ? "highlight" : ""}
              key={s.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(s)}
            >
              {s.operator === "delijn" ? (
                <BusFront size={18} />
              ) : (
                <TrainFront size={18} />
              )}
              <span>
                {s.name}
                <small>
                  {operators[s.operator].name} ·{" "}
                  {s.id.replace("delijn:", "").split(".").pop()}
                </small>
              </span>
            </button>
          ))}
          {!results.length && (
            <p>Geen halte gevonden. Probeer een andere naam.</p>
          )}
        </div>
      )}
    </div>
  );
}
