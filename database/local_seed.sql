-- Local-only seed: login with username "demo", password "demo"
insert into users (id, username, password_hash)
values ('local-demo-portfolio', 'demo', '2a97516c354b68848cdbd8f54a226a0a55b21ed138e207ad6c5cbb9c00aa5aea')
on conflict (id) do nothing;
