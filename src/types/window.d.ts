// public/config.js 在应用加载前注入的运行时配置
interface AppConfig {
  // 权限验证开关：'1' 开启，'0' 关闭
  AUTH_ACCESS?: string;
  ICP_NUMBER?: string;
}

declare global {
  interface Window {
    APP_CONFIG?: AppConfig;
  }
}

export {};
