/**
 * HALF HOLY - Bespoke OS 2.0 Web Components
 * Zero heavy frameworks. Native browser standards for maximum performance.
 */

// Speculation Rules API for instant sub-100ms page transitions
if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
  const specScript = document.createElement('script');
  specScript.type = 'speculationrules';
  specScript.textContent = JSON.stringify({
    prerender: [
      {
        source: 'document',
        where: {
          and: [
            { href_matches: '/*\\?*' },
            { not: { href_matches: '/cart*' } },
            { not: { href_matches: '/checkout*' } },
            { not: { href_matches: '/admin*' } }
          ]
        },
        eagerness: 'moderate'
      }
    ]
  });
  document.head.appendChild(specScript);
}

/**
 * Cart Drawer Custom Element
 */
class CartDrawer extends HTMLElement {
  constructor() {
    super();
    this.overlay = this.querySelector('[data-cart-overlay]');
    this.closeBtn = this.querySelector('[data-cart-close]');
    
    if (this.overlay) {
      this.overlay.addEventListener('click', () => this.close());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.classList.contains('active')) this.close();
    });
  }

  open() {
    this.classList.remove('hidden');
    // slight delay for transition
    requestAnimationFrame(() => {
      this.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  }

  close() {
    this.classList.remove('active');
    document.body.style.overflow = '';
    setTimeout(() => {
      this.classList.add('hidden');
    }, 250);
  }

  async updateCart() {
    try {
      const res = await fetch(`${window.routes.cart_url}?sections=cart-drawer-items`);
      const data = await res.json();
      const html = data['cart-drawer-items'];
      const container = this.querySelector('[data-cart-items-container]');
      if (container && html) {
        container.innerHTML = html;
      }
      // Update cart count badge
      const cartRes = await fetch(window.routes.cart_url + '.js');
      const cartData = await cartRes.json();
      document.querySelectorAll('[data-cart-count]').forEach(el => {
        el.textContent = `(${cartData.item_count})`;
      });
    } catch (e) {
      console.error('Error updating cart', e);
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
    const submitBtn = this.form.querySelector('[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'ADDING...';
    }

    try {
      const formData = new FormData(this.form);
      const res = await fetch(window.routes.cart_add_url, {
        method: 'POST',
        headers: { 'Accept': 'application/javascript' },
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
  constructor() {
    super();
    this.summary = this.querySelector('summary');
    this.icon = this.querySelector('[data-accordion-icon]');
    
    if (this.summary) {
      this.summary.addEventListener('click', () => {
        const isOpen = this.parentElement.hasAttribute('open');
        if (this.icon) {
          this.icon.textContent = isOpen ? '+' : '-';
        }
      });
    }
  }
}
customElements.define('accordion-drawer', AccordionDrawer);
