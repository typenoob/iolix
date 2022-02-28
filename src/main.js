import App from './App';
import router from './router'
import { createApp } from 'vue';
import { Button, Pagination } from 'ant-design-vue';
import 'ant-design-vue/dist/antd.css';

const app = createApp(App);
app.use(router).use(Button).use(Pagination).mount("#app");