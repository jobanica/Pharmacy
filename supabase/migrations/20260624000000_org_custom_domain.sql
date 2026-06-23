-- White-label: let an organization connect its own domain to its storefront.
alter table public.organizations
  add column if not exists custom_domain text;

-- One domain can map to at most one organization.
create unique index if not exists organizations_custom_domain_key
  on public.organizations (custom_domain)
  where custom_domain is not null;
