"use client";

interface ExtrasBarProps {
  showTax: boolean;
  showDelivery: boolean;
  taxAmount: string;
  deliveryAmount: string;
  onToggleTax: () => void;
  onToggleDelivery: () => void;
  onTaxChange: (value: string) => void;
  onDeliveryChange: (value: string) => void;
}

export default function ExtrasBar({
  showTax,
  showDelivery,
  taxAmount,
  deliveryAmount,
  onToggleTax,
  onToggleDelivery,
  onTaxChange,
  onDeliveryChange,
}: ExtrasBarProps) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex gap-2">
        <button
          onClick={onToggleTax}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            showTax
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {showTax ? "- Tax" : "+ Tax"}
        </button>
        <button
          onClick={onToggleDelivery}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            showDelivery
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          {showDelivery ? "- Delivery" : "+ Delivery"}
        </button>
      </div>

      {(showTax || showDelivery) && (
        <div className="flex gap-2">
          {showTax && (
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-gray-300">
                $
              </span>
              <input
                type="text"
                value={taxAmount}
                onChange={(e) => onTaxChange(e.target.value)}
                placeholder="Tax"
                className="h-8 w-28 rounded-md border border-gray-200 bg-white pr-2 pl-6 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          )}
          {showDelivery && (
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-gray-300">
                $
              </span>
              <input
                type="text"
                value={deliveryAmount}
                onChange={(e) => onDeliveryChange(e.target.value)}
                placeholder="Delivery"
                className="h-8 w-28 rounded-md border border-gray-200 bg-white pr-2 pl-6 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
