import './styles/main.css';
import './styles/cart.css';
import './styles/responsive.css';
import './styles/motion.css';
import { createCartStorage } from './infra/cart-storage';
import { initTelemetry } from './infra/telemetry';
import { installStampFallback } from './ui/art';
import { clearCart, initCart } from './ui/cart';
import { initCatalog } from './ui/catalog-view';
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
