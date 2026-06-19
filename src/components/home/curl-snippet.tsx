export function CurlSnippet() {
  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">FROM YOUR TERMINAL</div>
      <div className="bg-[#111315] border border-[#22262A] rounded p-3.5 font-mono text-[11px] leading-[1.7]">
        <div className="text-[#4F5354]"># no API key. free preview, x402-ready.</div>
        <div><span className="text-[#8A8E8C]">$</span> curl -X POST \</div>
        <div className="pl-3.5"><span className="text-[#7AB8FF]">https://cannastack.0x402.sh/api/strain-finder</span> \</div>
        <div className="pl-3.5">-H <span className="text-[#C8A6FF]">{`'Content-Type: application/json'`}</span> \</div>
        <div className="pl-3.5">-d <span className="text-[#C8A6FF]">{`'{"strain":"Blue Dream","location":"Phoenix, AZ"}'`}</span></div>
        <div className="mt-2.5 text-[#9DFFB5]">{`\u21b3 $0.02 metered value \u00b7 200 OK`}</div>
      </div>
    </div>
  );
}
