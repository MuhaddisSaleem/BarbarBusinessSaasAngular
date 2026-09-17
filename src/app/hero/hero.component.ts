import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  template: `
    <section class="royal-hero" id="home">
      <div class="hero-photo" aria-hidden="true"></div>
      <div class="hero-overlay" aria-hidden="true"></div>

      <div class="hero-shell">
        <header class="site-header">
          <a class="brand" href="#home" aria-label="Royal Barbers home">
            <span class="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 64 72" role="img">
                <path d="M15 17 22 8l10 9L42 8l7 9-4 9H19l-4-9Z" fill="currentColor"/>
                <circle cx="22" cy="8" r="2.8" fill="currentColor"/><circle cx="42" cy="8" r="2.8" fill="currentColor"/>
                <path d="M17 31 47 63M47 31 17 63" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
                <circle cx="13" cy="66" r="7" fill="none" stroke="currentColor" stroke-width="3"/>
                <circle cx="51" cy="66" r="7" fill="none" stroke="currentColor" stroke-width="3"/>
              </svg>
            </span>
            <span class="brand-copy">
              <strong>ROYAL BARBERS</strong>
              <small>LOOK GOOD · FEEL GREAT</small>
            </span>
          </a>

          <nav class="main-nav" aria-label="Main navigation">
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#services">Services</a>
            <a href="#gallery">Gallery</a>
            <a href="#contact">Contact</a>
          </nav>

          <a class="book-button" href="#booking">Book Appointment</a>
        </header>

        <div class="hero-content">
          <div class="hero-copy">
            <span class="eyebrow">PREMIUM BARBERSHOP</span>
            <h1>ROYAL BARBERS</h1>

            <div class="location-row">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.4A2.4 2.4 0 1 1 12 6.6a2.4 2.4 0 0 1 0 4.8Z" fill="currentColor"/></svg>
              <span>Bahawalpur, Pakistan</span>
            </div>

            <p class="tagline">More Than a Haircut. It's a Lifestyle.</p>

            <div class="hero-features">
              <div class="hero-feature">
                <span class="feature-icon star-icon" aria-hidden="true">★</span>
                <div><strong>4.9</strong><small>(120+ reviews)</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v6l4 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </span>
                <div><strong>Open until</strong><small>10:00 PM</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 28 24"><circle cx="9" cy="7" r="4" fill="currentColor"/><circle cx="20" cy="7" r="4" fill="currentColor"/><path d="M2 21v-3c0-4 3-7 7-7s7 3 7 7v3H2Zm12 0v-3c0-2-.6-4-1.8-5.5A7.2 7.2 0 0 1 20 11c4 0 7 3 7 7v3H14Z" fill="currentColor"/></svg>
                </span>
                <div><strong>Professional</strong><small>Barbers</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 28"><path d="M12 2 21 6v7c0 6-3.7 10.4-9 13-5.3-2.6-9-7-9-13V6l9-4Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m8 14 2.5 2.5L16.5 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
                <div><strong>Clean &amp; Safe</strong><small>Environment</small></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; background: #050708; }
    * { box-sizing: border-box; }

    .royal-hero {
      position: relative;
      width: 100%;
      height: 420px;
      min-height: 420px;
      overflow: hidden;
      color: #fff;
      background: #080b0c;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .hero-photo {
      position: absolute;
      inset: 0;
      background-image: url('https://images.pexels.com/photos/19664876/pexels-photo-19664876.jpeg?auto=compress&cs=tinysrgb&w=1920');
      background-size: cover;
      background-position: 64% 42%;
      filter: saturate(.72) contrast(1.08) brightness(.72);
      transform: scale(1.015);
    }

    .hero-overlay {
      position: absolute;
      inset: 0;
      background:
        linear-gradient(90deg, rgba(5,8,9,.97) 0%, rgba(5,8,9,.90) 24%, rgba(5,8,9,.66) 43%, rgba(5,8,9,.14) 65%, rgba(5,8,9,.20) 100%),
        linear-gradient(180deg, rgba(0,0,0,.12) 0%, rgba(0,0,0,.02) 50%, rgba(0,0,0,.42) 100%);
      pointer-events: none;
    }

    .hero-shell {
      position: relative;
      z-index: 2;
      width: min(100%, 1290px);
      height: 100%;
      margin: 0 auto;
      padding: 0 38px;
    }

    .site-header {
      height: 72px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      column-gap: 36px;
    }

    .brand {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: #fff;
      text-decoration: none;
    }

    .brand-mark {
      width: 42px;
      height: 52px;
      flex: 0 0 42px;
      color: #f4bd57;
    }

    .brand-mark svg { width: 100%; height: 100%; display: block; overflow: visible; }

    .brand-copy strong {
      display: block;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 16px;
      line-height: 1;
      font-weight: 500;
      letter-spacing: 4.2px;
      white-space: nowrap;
    }

    .brand-copy small {
      display: block;
      margin-top: 8px;
      color: #d0d0cd;
      font-size: 6px;
      line-height: 1;
      font-weight: 500;
      letter-spacing: 3.6px;
      white-space: nowrap;
    }

    .main-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 32px;
    }

    .main-nav a {
      position: relative;
      padding: 8px 0;
      color: #f4f4f2;
      text-decoration: none;
      font-size: 11px;
      line-height: 1;
      font-weight: 500;
      transition: color .18s ease;
    }

    .main-nav a::after {
      content: '';
      position: absolute;
      left: 50%;
      right: 50%;
      bottom: 1px;
      height: 1px;
      background: #f4bd57;
      transition: left .18s ease, right .18s ease;
    }

    .main-nav a:hover { color: #f4bd57; }
    .main-nav a:hover::after { left: 0; right: 0; }

    .book-button {
      justify-self: end;
      min-width: 151px;
      padding: 11px 18px;
      border: 1px solid #f4ca71;
      border-radius: 8px;
      background: linear-gradient(180deg, #ffd879 0%, #e7ab42 100%);
      box-shadow: 0 5px 16px rgba(0,0,0,.32), inset 0 1px rgba(255,255,255,.38);
      color: #111;
      text-align: center;
      text-decoration: none;
      font-size: 11px;
      line-height: 1;
      font-weight: 800;
    }

    .hero-content {
      height: calc(100% - 72px);
      display: flex;
      align-items: flex-start;
      padding-top: 50px;
    }

    .hero-copy { width: 620px; max-width: 55%; }

    .eyebrow {
      display: block;
      margin-bottom: 17px;
      color: #e9b654;
      font-size: 9px;
      line-height: 1;
      font-weight: 700;
      letter-spacing: 4.7px;
    }

    h1 {
      margin: 0;
      color: #fff;
      font-size: clamp(46px, 4.15vw, 62px);
      line-height: .96;
      font-weight: 900;
      letter-spacing: .2px;
      text-shadow: 0 3px 16px rgba(0,0,0,.38);
    }

    .location-row {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-top: 16px;
      color: #f3f3f1;
      font-size: 12px;
      line-height: 1;
    }

    .location-row svg {
      width: 17px;
      height: 21px;
      flex: 0 0 17px;
      color: #f1b94e;
    }

    .tagline {
      margin: 18px 0 0;
      color: #f3f3f1;
      font-size: 15px;
      line-height: 1.2;
      font-weight: 400;
    }

    .hero-features {
      display: flex;
      align-items: stretch;
      margin-top: 28px;
    }

    .hero-feature {
      min-width: 120px;
      min-height: 44px;
      padding: 0 20px;
      display: flex;
      align-items: center;
      gap: 11px;
      border-right: 1px solid rgba(255,255,255,.24);
    }

    .hero-feature:first-child { padding-left: 0; }
    .hero-feature:last-child { padding-right: 0; border-right: 0; }

    .feature-icon {
      width: 25px;
      height: 25px;
      flex: 0 0 25px;
      display: grid;
      place-items: center;
      color: #f3bd55;
    }

    .feature-icon svg { width: 100%; height: 100%; display: block; }
    .star-icon { font-size: 25px; line-height: 1; }

    .hero-feature strong,
    .hero-feature small { display: block; white-space: nowrap; }

    .hero-feature strong {
      color: #f5f5f3;
      font-size: 11px;
      line-height: 1.25;
      font-weight: 600;
    }

    .hero-feature small {
      margin-top: 3px;
      color: #d1d2d0;
      font-size: 8px;
      line-height: 1.25;
    }

    @media (min-width: 1500px) {
      .royal-hero { height: 460px; min-height: 460px; }
      .hero-shell { width: min(100%, 1420px); padding: 0 42px; }
      .site-header { height: 78px; }
      .hero-content { height: calc(100% - 78px); padding-top: 56px; }
      .hero-copy { width: 680px; }
      h1 { font-size: 68px; }
      .eyebrow { font-size: 10px; }
      .tagline { font-size: 17px; }
    }

    @media (max-width: 1100px) {
      .hero-shell { padding: 0 28px; }
      .site-header { grid-template-columns: 1fr auto; }
      .main-nav { display: none; }
      .hero-copy { max-width: 65%; }
      .hero-photo { background-position: 58% center; }
      .hero-features { flex-wrap: wrap; max-width: 570px; }
    }

    @media (max-width: 760px) {
      .royal-hero { height: 560px; min-height: 560px; }
      .hero-photo { background-position: 68% center; }
      .hero-overlay {
        background:
          linear-gradient(90deg, rgba(4,7,8,.94), rgba(4,7,8,.56)),
          linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.68));
      }
      .hero-shell { padding: 0 18px; }
      .site-header { height: 70px; }
      .brand-mark { width: 36px; height: 45px; flex-basis: 36px; }
      .brand-copy strong { font-size: 13px; letter-spacing: 2.6px; }
      .brand-copy small { font-size: 5.5px; letter-spacing: 2.1px; }
      .book-button { display: none; }
      .hero-content { height: calc(100% - 70px); align-items: flex-end; padding: 0 0 34px; }
      .hero-copy { width: 100%; max-width: 100%; }
      .eyebrow { font-size: 8px; letter-spacing: 3.5px; }
      h1 { font-size: 43px; }
      .location-row { font-size: 12px; }
      .tagline { font-size: 14px; }
      .hero-features { display: grid; grid-template-columns: 1fr 1fr; width: 100%; gap: 17px 0; margin-top: 25px; }
      .hero-feature { min-width: 0; padding: 0 13px; border-right: 0; }
      .hero-feature:nth-child(odd) { padding-left: 0; border-right: 1px solid rgba(255,255,255,.2); }
      .hero-feature strong { font-size: 10px; }
      .hero-feature small { font-size: 8px; }
    }

    @media (max-width: 420px) {
      .royal-hero { height: 540px; min-height: 540px; }
      h1 { font-size: 37px; }
      .brand-copy strong { font-size: 12px; }
      .tagline { font-size: 13px; }
    }
  `]
})
export class HeroComponent {}
