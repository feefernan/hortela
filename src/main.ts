import './styles/main.css';
import './styles/cart.css';
import './styles/responsive.css';
import './styles/motion.css';
import { useStock } from './domain/catalog';
import { createCartStorage } from './infra/cart-storage';
import { fetchCatalog } from './infra/order-api';
import { initTelemetry } from './infra/telemetry';
import { installStampFallback } from './ui/art';
import { clearCart, initCart, refreshCart } from './ui/cart';
import { initCatalog, refreshCatalog } from './ui/catalog-view';
import { initCheckout, openCartCheckout, openCheckout } from './ui/checkout';
import { bindActions } from './ui/dom';
import { installLazyImages, settleLoadedImages } from './ui/motion';
import { initRouter } from './ui/router';
import { initStudio } from './ui/studio';

void initTelemetry();

installLazyImages();
installStampFallback();
bindActions();
initCart(createCartStorage(), openCartCheckout);
initCatalog();
initStudio(openCheckout);
initCheckout(clearCart);
initRouter();
settleLoadedImages();

// O catálogo vem do Notion (peças, preço, estoque, imagem); até lá as grades ficam em skeleton.
// Se ele falhar, vale o catálogo do código.
fetchCatalog()
  .then(useStock)
  .catch(() => {})
  .finally(() => {
    refreshCatalog();
    refreshCart();
  });
