// TODO: Replace any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Data = any;
export type Pair = [Data, Data];
export type EmptyList = null;
export type List = Pair | EmptyList;

// Drawing-related types
export type Drawing = React.ReactElement;
export type Step = Drawing[];
