import { describe, expect, test } from "bun:test";
import {
  ancestorGroupIds,
  flattenNavItems,
  groupKeyAction,
  isNavGroup,
  nextNavIndex,
  visibleNavIds,
} from "./side-nav";

const leaf = (id) => ({ id });
const tree = [
  leaf("apercu"),
  { id: "demandes", children: [leaf("nouvelle"), leaf("suivi")] },
  { id: "donnees", children: [{ id: "sous", children: [leaf("profond")] }, leaf("export")] },
];

describe("isNavGroup", () => {
  test("un groupe a un tableau children, même vide", () => {
    expect(isNavGroup({ id: "g", children: [] })).toBe(true);
    expect(isNavGroup({ id: "g", children: [leaf("a")] })).toBe(true);
    expect(isNavGroup(leaf("a"))).toBe(false);
  });
});

describe("flattenNavItems", () => {
  test("groupe puis ses enfants, dans l'ordre, récursivement", () => {
    expect(flattenNavItems(tree).map((i) => i.id)).toEqual([
      "apercu",
      "demandes",
      "nouvelle",
      "suivi",
      "donnees",
      "sous",
      "profond",
      "export",
    ]);
  });

  test("liste vide", () => {
    expect(flattenNavItems([])).toEqual([]);
  });
});

describe("ancestorGroupIds", () => {
  test("de l'extérieur vers l'intérieur", () => {
    expect(ancestorGroupIds(tree, "profond")).toEqual(["donnees", "sous"]);
    expect(ancestorGroupIds(tree, "suivi")).toEqual(["demandes"]);
  });

  test("entrée de premier niveau ou inconnue : aucun groupe", () => {
    expect(ancestorGroupIds(tree, "apercu")).toEqual([]);
    expect(ancestorGroupIds(tree, "absent")).toEqual([]);
  });
});

describe("visibleNavIds", () => {
  test("groupes fermés : enfants masqués", () => {
    expect(visibleNavIds(tree, new Set())).toEqual(["apercu", "demandes", "donnees"]);
  });

  test("groupe ouvert : ses enfants suivent le groupe", () => {
    expect(visibleNavIds(tree, new Set(["demandes"]))).toEqual([
      "apercu",
      "demandes",
      "nouvelle",
      "suivi",
      "donnees",
    ]);
  });

  test("un enfant n'est visible que si tous ses ancêtres sont ouverts", () => {
    expect(visibleNavIds(tree, new Set(["sous"]))).toEqual(["apercu", "demandes", "donnees"]);
    expect(visibleNavIds(tree, new Set(["donnees", "sous"]))).toEqual([
      "apercu",
      "demandes",
      "donnees",
      "sous",
      "profond",
      "export",
    ]);
  });
});

describe("groupKeyAction", () => {
  const ctx = (o) => ({ isGroup: false, expanded: false, hasParent: false, ...o });

  test("ArrowRight déplie un groupe fermé, sinon rien", () => {
    expect(groupKeyAction("ArrowRight", ctx({ isGroup: true }))).toBe("expand");
    expect(groupKeyAction("ArrowRight", ctx({ isGroup: true, expanded: true }))).toBeNull();
    expect(groupKeyAction("ArrowRight", ctx())).toBeNull();
  });

  test("ArrowLeft replie un groupe ouvert", () => {
    expect(groupKeyAction("ArrowLeft", ctx({ isGroup: true, expanded: true }))).toBe("collapse");
    expect(
      groupKeyAction("ArrowLeft", ctx({ isGroup: true, expanded: true, hasParent: true })),
    ).toBe("collapse");
  });

  test("ArrowLeft depuis un enfant ou un groupe fermé avec parent : focus sur le parent", () => {
    expect(groupKeyAction("ArrowLeft", ctx({ hasParent: true }))).toBe("focus-parent");
    expect(groupKeyAction("ArrowLeft", ctx({ isGroup: true, hasParent: true }))).toBe(
      "focus-parent",
    );
  });

  test("ArrowLeft sans groupe ouvert ni parent, et autres touches : null", () => {
    expect(groupKeyAction("ArrowLeft", ctx())).toBeNull();
    expect(groupKeyAction("ArrowLeft", ctx({ isGroup: true }))).toBeNull();
    expect(groupKeyAction("Enter", ctx({ isGroup: true }))).toBeNull();
    expect(groupKeyAction("ArrowDown", ctx({ hasParent: true }))).toBeNull();
  });
});

describe("nextNavIndex", () => {
  test("ArrowDown avance et boucle à la fin", () => {
    expect(nextNavIndex(5, 0, "ArrowDown")).toBe(1);
    expect(nextNavIndex(5, 4, "ArrowDown")).toBe(0);
  });

  test("ArrowUp recule et boucle au début", () => {
    expect(nextNavIndex(5, 3, "ArrowUp")).toBe(2);
    expect(nextNavIndex(5, 0, "ArrowUp")).toBe(4);
  });

  test("Home et End vont aux extrémités", () => {
    expect(nextNavIndex(5, 2, "Home")).toBe(0);
    expect(nextNavIndex(5, 2, "End")).toBe(4);
  });

  test("sans entrée focalisée (-1) : ArrowDown va à la première, ArrowUp à la dernière", () => {
    expect(nextNavIndex(5, -1, "ArrowDown")).toBe(0);
    expect(nextNavIndex(5, -1, "ArrowUp")).toBe(4);
  });

  test("une seule entrée : les flèches restent sur elle", () => {
    expect(nextNavIndex(1, 0, "ArrowDown")).toBe(0);
    expect(nextNavIndex(1, 0, "ArrowUp")).toBe(0);
  });

  test("touche non gérée ou menu vide : null", () => {
    expect(nextNavIndex(5, 2, "Enter")).toBeNull();
    expect(nextNavIndex(5, 2, "ArrowRight")).toBeNull();
    expect(nextNavIndex(0, -1, "ArrowDown")).toBeNull();
  });
});
