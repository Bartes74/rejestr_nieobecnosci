Primary interactive control. Use `variant="primary"` for the single main action per view; `secondary`/`ghost` for supporting actions; `tint` for low-emphasis brand actions (e.g. export); `danger` for destructive.

```jsx
<Button variant="primary" icon={<PlusIcon/>} onClick={save}>Zapisz nieobecność</Button>
<Button variant="secondary" onClick={cancel}>Anuluj</Button>
```

Sizes: sm/md/lg. Always sentence case. Pair an icon with text for primary actions where helpful.