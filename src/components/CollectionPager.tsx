export function CollectionPager({
  page,
  label,
}: {
  page: { page: number; pages: number; setPage: (value: number) => void };
  label: string;
}) {
  if (page.pages <= 1) return null;
  return (
    <nav aria-label={label + ' pages'}>
      <button disabled={!page.page} onClick={() => page.setPage(page.page - 1)}>
        Previous {label}
      </button>
      <span>
        Page {page.page + 1} of {page.pages}
      </span>
      <button disabled={page.page + 1 === page.pages} onClick={() => page.setPage(page.page + 1)}>
        Next {label}
      </button>
    </nav>
  );
}
