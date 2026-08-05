Surface container for all panels. Provide `title`/`subtitle`/`right` for a header, or omit for a bare card. Tables go inside a Card with `padding={0}`.

```jsx
<Card title="Przypomnienia">…</Card>
<Card title="Kto zalega z urlopem" right={<Button variant="tint" size="sm">Eksport .xlsx</Button>}>…</Card>
```