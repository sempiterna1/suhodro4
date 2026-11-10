// Баланс «Последнего горизонта».
// Источник правды — типизированные модули данных в src/game/data/*.ts
// (combat, creeps, economy, maps, towers, waves, avatars).
// Этот файл — чистый re-export и точка входа: игровой код, UI и тесты читают баланс отсюда,
// но реальное место правды — модули данных, где его можно править без перекомпиляции логики.

export * from './data/combat'
export * from './data/creeps'
export * from './data/difficulties'
export * from './data/economy'
export * from './data/items'
export * from './data/maps'
export * from './data/towers'
export * from './data/waves'
export * from './data/avatars'
