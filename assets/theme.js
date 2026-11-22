/**
 * HALF HOLY - Bespoke OS 2.0 Web Components
 * Zero heavy frameworks. Native browser standards for maximum performance.
 */

// Fallback hover prefetch for browsers without native Speculation Rules (Firefox / older Safari)
if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) {
  const prefetchedUrls = new Set();
  document.addEventListener('pointerenter', (e) => {
    const link = e.target.closest('a[href^="/"]');
    if (!link || prefetchedUrls.has(link.href)) return;
    if (link.href.includes('/cart') || link.href.includes('/checkout') || link.href.includes('/admin')) return;
    prefetchedUrls.add(link.href);
    const prefetchLink = document.createElement('link');
    prefetchLink.rel = 'prefetch';
    prefetchLink.href = link.href;
    document.head.appendChild(prefetchLink);
  }, { passive: true, capture: true });
}

/**
 * Cart Drawer Custom Element
 */
class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = this.querySelector('[data-cart-overlay]');

    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('active')) this.close();
    });

    this.addEventListener('click', async (e) => {
      const closeBtn = e.target.closest('[data-cart-close]');
      if (closeBtn) {
        if (!closeBtn.getAttribute('href')) {
          e.preventDefault();
        }
        this.close();
        return;
      }

      const removeBtn = e.target.closest('[data-cart-remove]');
      if (removeBtn) {
        e.preventDefault();
        const line = removeBtn.dataset.line;
        removeBtn.disabled = true;
        try {
          const changeUrl = window.routes.cart_change_url.endsWith('.js') ? window.routes.cart_change_url : `${window.routes.cart_change_url}.js`;
          await fetch(changeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ line: parseInt(line, 10), quantity: 0 })
          });
          await this.updateCart();
        } catch (err) {
          console.error(err);
        }
        return;
      }

      const qtyBtn = e.target.closest('[data-cart-qty-change]');
      if (qtyBtn) {
        e.preventDefault();
        const delta = parseInt(qtyBtn.dataset.cartQtyChange, 10);
        const currentQty = parseInt(qtyBtn.dataset.currentQty, 10);
        const newQty = Math.max(0, currentQty + delta);
        const line = qtyBtn.dataset.line;
        qtyBtn.disabled = true;
        try {
          const changeUrl = window.routes.cart_change_url.endsWith('.js') ? window.routes.cart_change_url : `${window.routes.cart_change_url}.js`;
          await fetch(changeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({ line: parseInt(line, 10), quantity: newQty })
          });
          await this.updateCart();
        } catch (err) {
          console.error(err);
        }
        return;
      }
    });
  }

  open() {
    this.classList.remove('hidden');
    this.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      this.classList.add('active');
      document.body.style.overflow = 'hidden';
      const closeBtn = this.querySelector('[data-cart-close]');
      if (closeBtn) closeBtn.focus();
    });
  }

  close() {
    this.classList.remove('active');
    this.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    setTimeout(() => {
      this.classList.add('hidden');
    }, 400);
  }

  async updateCart() {
    try {
      this.classList.add('is-loading');
      const res = await fetch(`${window.routes.cart_url}?sections=cart-drawer-items`);
      const data = await res.json();
      const html = data['cart-drawer-items'];
      const container = this.querySelector('[data-cart-items-container]');
      if (container && html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const sectionEl = doc.querySelector('.shopify-section');
        container.innerHTML = sectionEl ? sectionEl.innerHTML : html;
      }
      const cartRes = await fetch(window.routes.cart_url + '.js');
      const cartData = await cartRes.json();
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent = `(${cartData.item_count})`;
      });
    } catch (e) {
      console.error(e);
    } finally {
      this.classList.remove('is-loading');
    }
  }
}
customElements.define('cart-drawer', CartDrawer);

/**
 * Product Form Custom Element (AJAX Add To Cart)
 */
class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.form = this.querySelector('form');
    if (this.form) {
      this.form.addEventListener('submit', this.onSubmit.bind(this));
    }
  }

  async onSubmit(e) {
    e.preventDefault();
    const submitBtn = e.submitter || this.form.querySelector('[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'ADDING...';
    }

    try {
      const formData = new FormData(this.form);
      const url = window.routes.cart_add_url.endsWith('.js') ? window.routes.cart_add_url : `${window.routes.cart_add_url}.js`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: formData
      });
      const data = await res.json();

      if (res.ok) {
        const cartDrawer = document.querySelector('cart-drawer');
        if (cartDrawer) {
          await cartDrawer.updateCart();
          cartDrawer.open();
        }
      } else {
        alert(data.description || 'Could not add to cart.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    }
  }
}
customElements.define('product-form', ProductForm);

/**
 * Variant Selector Custom Element
 */
class VariantSelector extends HTMLElement {
  constructor() {
    super();
    this.addEventListener('change', this.onVariantChange.bind(this));
  }

  onVariantChange() {
    const selectedOptions = Array.from(this.querySelectorAll('input:checked')).map(el => el.value);
    const variantsData = JSON.parse(this.querySelector('[type="application/json"]').textContent);

    const currentVariant = variantsData.find(variant => {
      return !variant.options.map((option, index) => {
        return selectedOptions[index] === option;
      }).includes(false);
    });

    if (!currentVariant) return;

    // Update hidden master input
    const masterInput = document.querySelector(`input[name="id"]`);
    if (masterInput) masterInput.value = currentVariant.id;

    // Update Price
    const priceContainer = document.querySelector('[data-product-price]');
    if (priceContainer) {
      priceContainer.textContent = (currentVariant.price / 100).toFixed(2) + ' ' + (window.Shopify?.currency?.active || 'USD');
    }

    // Update URL without full page reload
    window.history.replaceState({}, '', `${this.dataset.url}?variant=${currentVariant.id}`);

    // Update Gallery image if variant has featured image
    if (currentVariant.featured_media) {
      const activeImg = document.querySelector(`[data-media-id="${currentVariant.featured_media.id}"]`);
      if (activeImg) {
        activeImg.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    // Update Add to Cart button state
    const submitBtn = document.querySelector('[data-add-to-cart-btn]');
    if (submitBtn) {
      if (currentVariant.available) {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || 'Subscribe and Save';
      } else {
        submitBtn.disabled = true;
        submitBtn.textContent = 'SOLD OUT';
      }
    }
  }
}
customElements.define('variant-selector', VariantSelector);

/**
 * Accordion Drawer for PDP
 */
class AccordionDrawer extends HTMLElement {
  connectedCallback() {
    const allDetails = Array.from(this.querySelectorAll('details'));

    function closeItem(target) {
      if (!target.open || target.classList.contains('is-closing')) return;

      target.classList.add('is-closing');
      target.classList.remove('is-open');
      target.style.overflow = 'hidden';

      const startHeight = `${target.offsetHeight}px`;
      const targetSummary = target.querySelector('summary');
      const endHeight = `${targetSummary.offsetHeight}px`;

      if (target._faqAnim) target._faqAnim.cancel();

      target._faqAnim = target.animate(
        { height: [startHeight, endHeight] },
        { duration: 400, easing: 'ease-in-out' }
      );

      target._faqAnim.onfinish = () => {
        target.open = false;
        target.classList.remove('is-closing');
        target._faqAnim = null;
        target.style.height = '';
        target.style.overflow = '';
      };

      target._faqAnim.oncancel = () => {
        target.classList.remove('is-closing');
        target._faqAnim = null;
      };
    }

    function openItem(target) {
      target.classList.remove('is-closing');
      target.classList.add('is-open');
      target.style.overflow = 'hidden';

      const startHeight = `${target.offsetHeight}px`;
      target.open = true;

      window.requestAnimationFrame(() => {
        const targetSummary = target.querySelector('summary');
        const targetContent = target.querySelector('.faq__content');
        const endHeight = `${targetSummary.offsetHeight + targetContent.offsetHeight}px`;

        if (target._faqAnim) target._faqAnim.cancel();

        target._faqAnim = target.animate(
          { height: [startHeight, endHeight] },
          { duration: 400, easing: 'ease-in-out' }
        );

        target._faqAnim.onfinish = () => {
          target.open = true;
          target._faqAnim = null;
          target.style.height = '';
          target.style.overflow = '';
        };

        target._faqAnim.oncancel = () => {
          target._faqAnim = null;
        };
      });
    }

    allDetails.forEach((details) => {
      const summary = details.querySelector('summary');
      const content = details.querySelector('.faq__content');
      if (!summary || !content) return;

      if (details.open) {
        details.classList.add('is-open');
      }

      summary.addEventListener('click', (e) => {
        e.preventDefault();

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          const willOpen = !details.open;
          allDetails.forEach((other) => {
            if (other !== details) {
              other.open = false;
              other.classList.remove('is-open', 'is-closing');
            }
          });
          details.open = willOpen;
          details.classList.toggle('is-open', willOpen);
          return;
        }

        const isCurrentlyOpen = details.open && !details.classList.contains('is-closing');

        if (isCurrentlyOpen) {
          closeItem(details);
        } else {
          allDetails.forEach((other) => {
            if (other !== details && (other.open || other.classList.contains('is-open'))) {
              closeItem(other);
            }
          });
          openItem(details);
        }
      });
    });
  }
}
customElements.define('accordion-drawer', AccordionDrawer);

class ProductGallery extends HTMLElement {
  connectedCallback() {
    this.thumbs = Array.from(this.querySelectorAll('[data-thumb-index]'));
    this.mainImg = this.querySelector('[data-main-image]');
    this.thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => this.selectThumb(thumb));
      thumb.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectThumb(thumb);
        }
      });
    });

    const samplePicker = this.querySelector('[data-sample-variant-picker]');
    if (samplePicker) {
      samplePicker.querySelectorAll('[data-option-group]').forEach(btn => {
        btn.addEventListener('click', () => {
          const group = btn.dataset.optionGroup;
          samplePicker.querySelectorAll(`[data-option-group="${group}"]`).forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
        });
      });
    }
  }

  selectThumb(thumb) {
    this.thumbs.forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    thumb.classList.add('is-active');
    thumb.setAttribute('aria-selected', 'true');
    const fullSrc = thumb.dataset.fullSrc;
    if (fullSrc && this.mainImg) {
      this.mainImg.src = fullSrc;
      this.mainImg.srcset = '';
    }
  }
}
customElements.define('product-gallery', ProductGallery);


class CampaignGallery extends HTMLElement {
  connectedCallback() {
    this.initDesktop();
    this.initMobile();
  }

  initDesktop() {
    const stickyCol = this.querySelector('.campaign-gallery__sticky-col');
    const scrollItems = Array.from(this.querySelectorAll('[data-scroll-item]'));
    const stackBtns = Array.from(this.querySelectorAll('[data-stack-btn]'));
    if (!stickyCol || !scrollItems.length || !stackBtns.length) return;

    stackBtns.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        if (scrollItems[index]) {
          scrollItems[index].scrollIntoView({ behavior: 'smooth' });
        }
      });
    });

    const thumbHeight = 82;
    const totalThumbs = stackBtns.length;

    const updateStack = () => {
      if (window.innerWidth <= 767) return;

      const vh = window.innerHeight;
      const baseStackTop = Math.max(64, (vh - totalThumbs * thumbHeight) / 2);
      const stickyRect = stickyCol.getBoundingClientRect();

      let closestIndex = 0;
      let minDistance = Infinity;

      scrollItems.forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();
        const itemCenterInSticky = (itemRect.top + itemRect.height / 2) - stickyRect.top;
        const stackY = baseStackTop + index * thumbHeight;
        const targetY = itemCenterInSticky - thumbHeight / 2;
        const finalY = Math.max(stackY, targetY);

        const btn = stackBtns[index];
        if (btn) {
          btn.style.transform = `translate3d(0, ${Math.round(finalY)}px, 0)`;
        }

        const dist = Math.abs(itemRect.top + itemRect.height / 2 - vh / 2);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = index;
        }
      });

      stackBtns.forEach((b, i) => {
        if (i === closestIndex) {
          b.classList.add('is-active');
        } else {
          b.classList.remove('is-active');
        }
      });
    };

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateStack();
          ticking = false;
        });
        ticking = true;
      }
    };

    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', onScroll, { passive: true });
          window.addEventListener('resize', onScroll, { passive: true });
          updateStack();
        } else {
          window.removeEventListener('scroll', onScroll);
          window.removeEventListener('resize', onScroll);
        }
      });
    }, { rootMargin: '300px 0px' });

    sectionObserver.observe(this);
    updateStack();
  }

  initMobile() {
    const mobileTabs = Array.from(this.querySelectorAll('[data-mobile-tab]'));
    const mobileSlides = Array.from(this.querySelectorAll('[data-mobile-slide]'));
    if (!mobileTabs.length || !mobileSlides.length) return;

    mobileTabs.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        mobileTabs.forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        mobileSlides.forEach(s => s.classList.remove('is-active'));

        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        if (mobileSlides[index]) {
          mobileSlides[index].classList.add('is-active');
        }
      });
    });
  }
}
customElements.define('campaign-gallery', CampaignGallery);


/**
 * Hero Section Custom Element (Auto-switching Gallery & Click-to-switch)
 */
class HeroSection extends HTMLElement {
  constructor() {
    super();
    this.slides = Array.from(this.querySelectorAll('[data-hero-slide]'));
    this.thumbs = Array.from(this.querySelectorAll('[data-hero-thumb]'));
    this.titleEl = this.querySelector('[data-hero-product-title]');
    this.linkEl = this.querySelector('[data-hero-product-link]');
    this.modal = this.querySelector('[data-hero-floating-modal]');
    this.modalClose = this.querySelector('[data-hero-modal-close]');
    this.speed = parseInt(this.dataset.autoplaySpeed, 10) || 4000;
    this.currentIndex = 0;
    this.timer = null;
  }

  connectedCallback() {
    if (this.thumbs.length > 0) {
      this.thumbs.forEach((thumb, idx) => {
        thumb.addEventListener('click', (e) => {
          e.preventDefault();
          this.goToSlide(idx);
          this.resetAutoplay();
        });
      });
    }

    if (this.modal) {
      setTimeout(() => {
        if (!this.modal.classList.contains('is-dismissed')) {
          this.modal.classList.add('is-visible');
        }
      }, 3000);

      if (this.modalClose) {
        this.modalClose.addEventListener('click', () => {
          this.modal.classList.remove('is-visible');
          this.modal.classList.add('is-dismissed');
        });
      }
    }

    this.addEventListener('pointerenter', () => this.stopAutoplay());
    this.addEventListener('pointerleave', () => this.startAutoplay());

    let touchStartX = 0;
    let touchEndX = 0;
    this.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    this.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 50) {
        this.nextSlide();
        this.resetAutoplay();
      } else if (touchEndX - touchStartX > 50) {
        this.prevSlide();
        this.resetAutoplay();
      }
    }, { passive: true });

    this.startAutoplay();
  }

  goToSlide(index) {
    if (index === this.currentIndex || index < 0 || index >= this.slides.length) return;

    // Previous active
    const prevSlide = this.slides[this.currentIndex];
    const prevThumb = this.thumbs[this.currentIndex];
    if (prevSlide) {
      prevSlide.classList.remove('is-active');
      prevSlide.setAttribute('aria-hidden', 'true');
    }
    if (prevThumb) {
      prevThumb.classList.remove('is-active');
      prevThumb.setAttribute('aria-selected', 'false');
    }

    this.currentIndex = index;

    // Next active
    const nextSlide = this.slides[this.currentIndex];
    const nextThumb = this.thumbs[this.currentIndex];
    if (nextSlide) {
      nextSlide.classList.add('is-active');
      nextSlide.setAttribute('aria-hidden', 'false');
    }
    if (nextThumb) {
      nextThumb.classList.add('is-active');
      nextThumb.setAttribute('aria-selected', 'true');
    }

    // Update Title & Link with quick smooth fade
    if (nextSlide && (this.titleEl || this.linkEl)) {
      const nextTitle = nextSlide.dataset.productTitle || '';
      const nextUrl = nextSlide.dataset.productUrl || '#';

      if (this.titleEl) {
        this.titleEl.style.opacity = '0';
        setTimeout(() => {
          this.titleEl.textContent = nextTitle;
          this.titleEl.style.opacity = '1';
        }, 150);
      }
      if (this.linkEl) {
        this.linkEl.href = nextUrl;
      }
    }
  }

  nextSlide() {
    if (this.slides.length <= 1) return;
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.goToSlide(nextIndex);
  }

  prevSlide() {
    if (this.slides.length <= 1) return;
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.goToSlide(prevIndex);
  }

  startAutoplay() {
    this.stopAutoplay();
    if (this.slides.length > 1 && this.speed > 0) {
      this.timer = setInterval(() => this.nextSlide(), this.speed);
    }
  }

  stopAutoplay() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  resetAutoplay() {
    this.stopAutoplay();
    this.startAutoplay();
  }

  disconnectedCallback() {
    this.stopAutoplay();
  }
}
customElements.define('hero-section', HeroSection);

const initHeaderNav = () => {
  const header = document.querySelector('.site-header');
  if (!header) return;

  const menuTrigger = header.querySelector('[data-mobile-menu-trigger]');
  if (menuTrigger) {
    menuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = header.classList.toggle('is-menu-open');
      menuTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (header.classList.contains('is-menu-open') && !header.contains(e.target)) {
        header.classList.remove('is-menu-open');
        menuTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && header.classList.contains('is-menu-open')) {
        header.classList.remove('is-menu-open');
        menuTrigger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  const updateHeaderColor = () => {
    const headerHeight = header.offsetHeight || 40;
    const probeY = headerHeight / 2;

    const lightHeaderSections = document.querySelectorAll('[data-header-color="light"], .hero-section');
    let isOverLightHeaderSection = false;

    lightHeaderSections.forEach((sec) => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= probeY && rect.bottom > probeY) {
        isOverLightHeaderSection = true;
      }
    });

    if (isOverLightHeaderSection) {
      header.classList.add('is-light');
    } else {
      header.classList.remove('is-light');
    }
  };

  window.addEventListener('scroll', updateHeaderColor, { passive: true });
  window.addEventListener('resize', updateHeaderColor, { passive: true });
  updateHeaderColor();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeaderNav);
} else {
  initHeaderNav();
}
