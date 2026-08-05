Modal dialog for confirmations (delete/undo) and focused forms. Provide `footer` with Buttons.

```jsx
<Dialog open={open} onClose={close} title="Usunąć wpis?" footer={<><Button variant="secondary" onClick={close}>Anuluj</Button><Button variant="danger">Usuń</Button></>}>Tej operacji nie można cofnąć.</Dialog>
```