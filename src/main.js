import { createApp } from 'vue';
import { Button, Image, Card, Menu } from 'ant-design-vue';
import App from './App';
import 'ant-design-vue/dist/antd.css';

const app = createApp(App);

/* 会自动注册 Button 下的子组件, 例如 Button.Group */
app.use(Button).use(Image).use(Card).use(Menu).mount('#app');
