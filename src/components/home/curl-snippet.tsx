export function CurlSnippet() {
  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">FROM YOUR TERMINAL</div>
      <div className="bg-[#111315] border border-[#22262A] rounded p-3.5 font-mono text-[11px] leading-[1.7]">
        <div className="text-[#4F5354]"># step 1 — case the joint. free.</div>
        <div>
          <span className="text-[#8A8E8C]">$</span> curl{' '}
          <span className="text-[#7AB8FF]">https://cannastack.0x402.sh/api/crawl/status</span>
        </div>
        <div className="text-[#4F5354]">{`↳ {"stats":{"total_menu_items":…,"last_crawl":…}}`}</div>
        <div className="mt-2.5 text-[#4F5354]"># step 2 — ask a real question. $0.02, no api key.</div>
        <div><span className="text-[#8A8E8C]">$</span> curl -X POST \</div>
        <div className="pl-3.5"><span className="text-[#7AB8FF]">https://cannastack.0x402.sh/api/strain-finder</span> \</div>
        <div className="pl-3.5">-H <span className="text-[#C8A6FF]">{`'Content-Type: application/json'`}</span> \</div>
        <div className="pl-3.5">-d <span className="text-[#C8A6FF]">{`'{"strain":"Blue Dream","location":"Denver, CO"}'`}</span></div>
        <div className="mt-2.5 text-[#9DFFB5]">↳ 402 → pay → $0.02 settled · 200 OK</div>
      </div>
    </div>
  );
}
