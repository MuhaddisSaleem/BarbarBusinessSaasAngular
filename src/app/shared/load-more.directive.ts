import { AfterViewInit, Directive, ElementRef, EventEmitter, NgZone, OnDestroy, Output } from '@angular/core';

/** Observe only the active catalog's end; the button remains a keyboard/browser fallback. */
@Directive({ selector: '[appLoadMore]', standalone: true })
export class LoadMoreDirective implements AfterViewInit, OnDestroy {
  @Output() reached = new EventEmitter<void>();
  private observer?: IntersectionObserver;

  constructor(private element: ElementRef<HTMLElement>, private zone: NgZone) {}

  ngAfterViewInit(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          this.observer?.disconnect();
          this.zone.run(() => this.reached.emit());
        }
      }, { threshold: 0.1 });
      this.observer.observe(this.element.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
