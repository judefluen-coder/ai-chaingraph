import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2X2, X } from "lucide-react";
import { localize } from "../lib/transmissionViewModel.js";

export function ChainNavigator({ navigation, activeChainId, onOverview, onSelect, locale, copy }) {
  const rootRef = useRef(null);
  const scrollerRef = useRef(null);
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [scrollState, setScrollState] = useState({ left: false, right: false });
  const chains = navigation.flatMap((group) => group.chains);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;
    const update = () => setScrollState({
      left: scroller.scrollLeft > 2,
      right: scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 2,
    });
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    scroller.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", update);
    };
  }, [chains.length, locale]);

  useEffect(() => {
    if (!directoryOpen) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setDirectoryOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    return () => document.removeEventListener("pointerdown", closeOnOutside);
  }, [directoryOpen]);

  function scrollByPage(direction) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollBy({ left: direction * Math.max(260, scroller.clientWidth * 0.72), behavior: "smooth" });
  }

  function selectChain(chainId) {
    onSelect(chainId);
    setDirectoryOpen(false);
  }

  return (
    <nav className="txChainNav" aria-label={copy.allChains} ref={rootRef}>
      <span className="txChainNavLabel">{copy.industryEntry}</span>
      <button type="button" className={`txOverviewButton ${activeChainId ? "" : "isActive"}`} onClick={onOverview}>
        {copy.overview}
      </button>
      <button
        className="txChainScrollButton"
        type="button"
        aria-label={copy.previousChains}
        title={copy.previousChains}
        disabled={!scrollState.left}
        onClick={() => scrollByPage(-1)}
      >
        <ChevronLeft size={17} strokeWidth={1.8} />
      </button>
      <div className="txChainScroller" ref={scrollerRef}>
        {chains.map((chain) => (
          <button
            key={chain.id}
            type="button"
            data-chain-id={chain.id}
            className={activeChainId === chain.id ? "isActive" : ""}
            aria-pressed={activeChainId === chain.id}
            onClick={() => selectChain(chain.id)}
          >
            {localize(chain, "name", locale)}
          </button>
        ))}
      </div>
      <button
        className="txChainScrollButton"
        type="button"
        aria-label={copy.nextChains}
        title={copy.nextChains}
        disabled={!scrollState.right}
        onClick={() => scrollByPage(1)}
      >
        <ChevronRight size={17} strokeWidth={1.8} />
      </button>
      <button
        type="button"
        className={`txDirectoryButton ${directoryOpen ? "isActive" : ""}`}
        aria-expanded={directoryOpen}
        onClick={() => setDirectoryOpen((value) => !value)}
      >
        <Grid2X2 size={16} strokeWidth={1.8} />
        <span>{chains.length}</span>
      </button>

      {directoryOpen && (
        <section className="txChainDirectory" aria-label={copy.chainDirectory}>
          <header>
            <div>
              <strong>{copy.chainDirectory}</strong>
              <span>{navigation.length} {copy.domains} · {chains.length} {copy.chains}</span>
            </div>
            <button type="button" className="txIconButton" aria-label={copy.closeDirectory} title={copy.closeDirectory} onClick={() => setDirectoryOpen(false)}>
              <X size={18} strokeWidth={1.8} />
            </button>
          </header>
          <div className="txDomainDirectory">
            {navigation.map(({ domain, chains: domainChains }) => (
              <section key={domain.id}>
                <h2>{localize(domain, "name", locale)}</h2>
                <div>
                  {domainChains.map((chain) => (
                    <button
                      key={chain.id}
                      type="button"
                      className={activeChainId === chain.id ? "isActive" : ""}
                      onClick={() => selectChain(chain.id)}
                    >
                      <span>{localize(chain, "name", locale)}</span>
                      <ChevronRight size={15} strokeWidth={1.8} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}
    </nav>
  );
}
