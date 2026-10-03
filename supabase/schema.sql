create extension if not exists "uuid-ossp";
create table transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null default auth.uid(),
  merchant text,
  amount decimal(14, 2),
  date date,
  type text not null default 'expense' check (type in ('income', 'expense')),
  category text,
  created_at timestamptz default now()
);
alter table transactions enable row level security;
create policy "own transactions" on transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Private bucket: files are only reachable by their owner (or via short-lived signed URLs).
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);
create policy "upload own receipts" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own receipts" on storage.objects for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own receipts" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
