'use strict';

const { createApp } = require('./app');
const { waitForDb } = require('./db');
const store = require('./data/store');

const PORT = process.env.PORT || 4920;

async function main() {
  await waitForDb();

  if (process.env.SEED_ON_START !== 'false') {
    const students = await store.listStudents();
    if (students.length === 0) {
      await store.seed();
      // eslint-disable-next-line no-console
      console.log('已写入种子数据');
    }
  }

  const app = createApp();
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`学生小饭桌管理平台 API 已启动: http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('启动失败：', err);
  process.exit(1);
});
