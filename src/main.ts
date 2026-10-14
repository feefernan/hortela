import './styles/main.css';
import { createLocalOrderRepository } from './infra/local-order-repository';
import { installStampFallback } from './ui/art';
import { initCart } from './ui/cart-badge';
import { initCatalog } from './ui/catalog-view';
import { initCheckout, openCheckout } from './ui/checkout';
import { bindActions } from './ui/dom';
import { initPanel } from './ui/panel';
import { initRouter } from './ui/router';
import { initStudio } from './ui/studio';

const orders = createLocalOrderRepository();

installStampFallback();
bindActions();
initCart();
initCatalog();
initStudio(openCheckout);
initCheckout(orders);
initPanel(orders);
initRouter();
