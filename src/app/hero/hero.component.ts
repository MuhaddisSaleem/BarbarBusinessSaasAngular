import { Component } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  template: `
    <section class="royal-hero" id="home">
      <div class="hero-shade"></div>

      <div class="hero-shell">
        <header class="site-header">
          <a class="brand" href="#home" aria-label="Royal Barbers home">
            <span class="brand-mark" aria-hidden="true">
              <span class="crown">♛</span>
              <span class="scissors">✂</span>
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
              <span class="pin" aria-hidden="true">●</span>
              <span>Bahawalpur, Pakistan</span>
            </div>

            <p class="tagline">More Than a Haircut. It's a Lifestyle.</p>

            <div class="hero-features">
              <div class="hero-feature">
                <span class="feature-icon">★</span>
                <div><strong>4.9</strong><small>(120+ reviews)</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon clock">◷</span>
                <div><strong>Open until</strong><small>10:00 PM</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon">♟</span>
                <div><strong>Professional</strong><small>Barbers</small></div>
              </div>

              <div class="hero-feature">
                <span class="feature-icon shield">✓</span>
                <div><strong>Clean &amp; Safe</strong><small>Environment</small></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .royal-hero {
      min-height: 458px;
      position: relative;
      overflow: hidden;
      color: #fff;
      background:
        linear-gradient(90deg, rgba(4,7,8,.96) 0%, rgba(4,7,8,.84) 34%, rgba(4,7,8,.30) 67%, rgba(4,7,8,.48) 100%),
        url('https://images.pexels.com/photos/7697268/pexels-photo-7697268.jpeg?auto=compress&cs=tinysrgb&w=1800') center 42% / cover no-repeat;
      border-bottom: 1px solid rgba(255,255,255,.08);
    }

    .hero-shade {
      position: absolute;
      inset: 0;
      pointer-events: none;
      background:
        radial-gradient(circle at 54% 55%, transparent 0%, transparent 24%, rgba(0,0,0,.14) 72%),
        linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,.28));
    }

    .hero-shell {
      width: min(100%, 1560px);
      min-height: 458px;
      margin: 0 auto;
      padding: 0 46px;
      position: relative;
      z-index: 1;
    }

    .site-header {
      height: 78px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 34px;
    }

    .brand {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      gap: 14px;
      color: #fff;
      text-decoration: none;
    }

    .brand-mark {
      width: 48px;
      height: 58px;
      position: relative;
      display: grid;
      place-items: center;
      color: #f2bf5a;
    }

    .brand-mark .scissors {
      font-size: 38px;
      line-height: 1;
      transform: rotate(-7deg);
    }

    .brand-mark .crown {
      position: absolute;
      top: -1px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 18px;
      line-height: 1;
    }

    .brand-copy strong {
      display: block;
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 4.5px;
      white-space: nowrap;
    }

    .brand-copy small {
      display: block;
      margin-top: 7px;
      color: #c5c6c4;
      font-size: 7px;
      font-weight: 500;
      letter-spacing: 4px;
      white-space: nowrap;
    }

    .main-nav {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 39px;
    }

    .main-nav a {
      color: #f4f4f2;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      transition: color .18s ease;
    }

    .main-nav a:hover { color: #f2bf5a; }

    .book-button {
      justify-self: end;
      min-width: 165px;
      padding: 13px 20px;
      border: 1px solid #f5cb72;
      border-radius: 9px;
      background: linear-gradient(180deg, #ffd77c 0%, #e8ad45 100%);
      box-shadow: 0 5px 18px rgba(0,0,0,.28), inset 0 1px rgba(255,255,255,.38);
      color: #111;
      text-align: center;
      text-decoration: none;
      font-size: 13px;
      font-weight: 800;
    }

    .hero-content {
      min-height: 380px;
      display: flex;
      align-items: center;
      padding: 20px 0 31px;
    }

    .hero-copy { width: min(100%, 690px); }

    .eyebrow {
      display: block;
      margin-bottom: 18px;
      color: #f2bf5a;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 5px;
    }

    h1 {
      margin: 0;
      font-size: clamp(46px, 5.2vw, 74px);
      line-height: .98;
      font-weight: 900;
      letter-spacing: 1.5px;
      text-shadow: 0 3px 15px rgba(0,0,0,.28);
    }

    .location-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 20px;
      color: #f2f2f0;
      font-size: 15px;
    }

    .pin {
      width: 19px;
      height: 25px;
      display: grid;
      place-items: center;
      color: #f2bf5a;
      font-size: 21px;
      transform: scaleX(.75);
    }

    .tagline {
      margin: 20px 0 0;
      color: #f3f3f1;
      font-size: 18px;
      font-weight: 400;
    }

    .hero-features {
      display: flex;
      align-items: stretch;
      margin-top: 31px;
    }

    .hero-feature {
      min-width: 135px;
      min-height: 45px;
      padding: 0 24px;
      display: flex;
      align-items: center;
      gap: 12px;
      border-right: 1px solid rgba(255,255,255,.24);
    }

    .hero-feature:first-child { padding-left: 0; }
    .hero-feature:last-child { border-right: 0; }

    .feature-icon {
      color: #f2bf5a;
      font-size: 23px;
      line-height: 1;
    }

    .feature-icon.clock { font-size: 27px; }

    .feature-icon.shield {
      width: 24px;
      height: 27px;
      display: grid;
      place-items: center;
      border: 2px solid #f2bf5a;
      border-radius: 6px 6px 10px 10px;
      font-size: 12px;
    }

    .hero-feature strong,
    .hero-feature small { display: block; }

    .hero-feature strong {
      color: #f4f4f2;
      font-size: 13px;
      line-height: 1.25;
      font-weight: 600;
    }

    .hero-feature small {
      margin-top: 3px;
      color: #d1d2d0;
      font-size: 10px;
      line-height: 1.25;
    }

    @media (max-width: 1050px) {
      .hero-shell { padding: 0 28px; }
      .site-header { grid-template-columns: 1fr auto; }
      .main-nav { display: none; }
      .hero-features { flex-wrap: wrap; gap: 18px 0; }
      .hero-feature { min-width: 25%; }
    }

    @media (max-width: 720px) {
      .royal-hero, .hero-shell { min-height: 500px; }
      .hero-shell { padding: 0 18px; }
      .site-header { height: 72px; }
      .brand-copy strong { font-size: 14px; letter-spacing: 2.5px; }
      .brand-copy small { font-size: 6px; letter-spacing: 2.2px; }
      .brand-mark { width: 38px; }
      .brand-mark .scissors { font-size: 31px; }
      .book-button { display: none; }
      .hero-content { min-height: 420px; align-items: flex-end; padding-bottom: 38px; }
      h1 { font-size: 45px; }
      .eyebrow { font-size: 9px; letter-spacing: 3.5px; }
      .tagline { font-size: 15px; }
      .hero-features { display: grid; grid-template-columns: 1fr 1fr; width: 100%; gap: 18px 0; }
      .hero-feature { min-width: 0; padding: 0 14px; border-right: 0; }
      .hero-feature:nth-child(odd) { padding-left: 0; border-right: 1px solid rgba(255,255,255,.2); }
    }

    @media (max-width: 430px) {
      .brand-copy strong { font-size: 12px; }
      .brand-copy small { letter-spacing: 1.7px; }
      h1 { font-size: 39px; }
      .location-row { font-size: 13px; }
    }
  `]
})
export class HeroComponent {}
