import { roundUnits, type Assignments, type Person } from "@/lib/split-bill";

export interface SplitState {
  people: Person[];
  nextId: number;
  assignments: Assignments;
  /** which person is the signed-in user, so "Save my portion" knows whose total to store */
  meId: number | null;
}

export type SplitAction =
  | { type: "addPerson"; name: string }
  | { type: "removePerson"; id: number }
  | { type: "setMe"; id: number | null }
  /** `max` is the most this person can hold: the item's qty minus what others already took */
  | { type: "setUnits"; item: number; person: number; units: number; max: number }
  | { type: "assignOne"; item: number; person: number | null }
  | { type: "splitEvenly"; item: number; qty: number };

export const initialSplitState: SplitState = { people: [], nextId: 1, assignments: {}, meId: null };

export function splitReducer(state: SplitState, action: SplitAction): SplitState {
  switch (action.type) {
    case "addPerson": {
      const name = action.name.trim();
      if (!name) return state;
      return { ...state, people: [...state.people, { id: state.nextId, name }], nextId: state.nextId + 1 };
    }
    case "removePerson": {
      const assignments = Object.fromEntries(
        Object.entries(state.assignments).map(([item, byPerson]) => [
          item,
          Object.fromEntries(Object.entries(byPerson).filter(([id]) => Number(id) !== action.id)),
        ]),
      );
      return {
        ...state,
        people: state.people.filter((p) => p.id !== action.id),
        assignments,
        meId: state.meId === action.id ? null : state.meId,
      };
    }
    case "setMe":
      return { ...state, meId: action.id };
    case "setUnits": {
      const units = roundUnits(Math.min(Math.max(action.units, 0), action.max));
      return { ...state, assignments: { ...state.assignments, [action.item]: { ...state.assignments[action.item], [action.person]: units } } };
    }
    case "assignOne":
      // single-qty item: exactly one eater, or nobody
      return { ...state, assignments: { ...state.assignments, [action.item]: action.person === null ? {} : { [action.person]: 1 } } };
    case "splitEvenly": {
      if (!state.people.length) return state;
      const each = roundUnits(action.qty / state.people.length);
      return {
        ...state,
        assignments: { ...state.assignments, [action.item]: Object.fromEntries(state.people.map((p) => [p.id, each])) },
      };
    }
  }
}
