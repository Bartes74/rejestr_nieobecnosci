Data table inside a card frame. Column `width` is a CSS grid track (e.g. "1.7fr"). Cells accept nodes — drop in Badge/AbsencePill. Use mono columns for figures/dates.

```jsx
<Table columns={[{key:'osoba',label:'OSOBA',width:'1.7fr',bold:true},{key:'zalega',label:'ZALEGA',mono:true}]} rows={[{osoba:'Tomasz Lewandowski',zalega:'8 dni'}]} />
```