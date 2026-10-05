import { AfterViewInit, Directive, ElementRef, EventEmitter, NgZone, OnDestroy, Output } from '@angular/core';

/** Observe only the active catalog's end; the button remains a keyboard/browser fallback. */
@Directive({ selector: '[appLoadMore]', standalone: true })
export class LoadMoreDirective implements AfterViewInit, OnDestroy {
  @Output() reached = new EventEmitter<void>();
  private observer?: IntersectionObserver;
  private isInsideViewport = false;

  constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(entries => {
        const isIntersecting = entries.some(entry => entry.isIntersecting);

        if (!isIntersecting) {
          this.isInsideViewport = false;
          return;
        }

        // Header deep-link navigation can cross the catalog sentinel while
        // travelling to the footer. Do not treat that programmatic jump as
        // genuine customer browsing; keep observing for the next manual pass.
        if (document.documentElement.hasAttribute('data-programmatic-anchor-scroll')) return;

        // Emit only once per viewport entry. When a new service batch pushes
        // the sentinel below the viewport it automatically re-arms, so the
        // next user scroll loads the next small batch instead of everything.
        if (this.isInsideViewport) return;
        this.isInsideViewport = true;
        this.zone.run(() => this.reached.emit());
      }, {
        threshold: 0.01,
        rootMargin: '0px 0px 90px 0px'
      });
      this.observer.observe(this.element.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
