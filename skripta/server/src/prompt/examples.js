// Worked examples shown to the model so it can see the exact bar its own
// output must clear — one per section type that's hardest to get right
// without a concrete reference (subtle distractors, genuine step-by-step
// derivations, active-recall phrasing).

export const CHAPTER_WORKED_EXAMPLE = `EXAMPLE OF EXPECTED CHAPTER DEPTH (illustrative — match this depth/style, not this topic):
{
  "title": "Binary Search Trees: Insertion and Balance",
  "description": "A **binary search tree (BST)** maintains the invariant that for any node, every key in its left subtree is smaller and every key in its right subtree is larger...\\n\\n### Insertion Mechanics\\nInserting a new key means walking from the root...\\n\\n\`\`\`concept\\nThe BST invariant must hold at every single node, not just the root — this is what makes search $O(h)$ where $h$ is tree height.\\n\`\`\`\\n\\n...(continues for 200-450 words total)...",
  "key_points": ["Insertion always creates a new leaf", "Search, insert, and delete are all $O(h)$", "An unbalanced BST degrades to $O(n)$ — a sorted-order insertion sequence produces a linked list"],
  "formulas": [{"formula": "h \\\\geq \\\\lceil \\\\log_2(n+1) \\\\rceil - 1", "when_to_use": "Establishing the theoretical minimum height for a BST with $n$ nodes, used to argue why balance matters.", "example": "For $n = 15$ nodes: $h \\\\geq \\\\lceil \\\\log_2(16) \\\\rceil - 1 = \\\\lceil 4 \\\\rceil - 1 = 3$. A perfectly balanced 15-node tree has height 3; a degenerate (linked-list) insertion order instead gives height 14."}],
  "diagrams_or_tables_explained": [],
  "images": []
}`;

export const QUIZ_WORKED_EXAMPLE = `EXAMPLE OF EXPECTED QUIZ QUALITY (illustrative — match this bar for distractor plausibility, not this topic):
{
  "question": "A BST is built by inserting keys in strictly increasing sorted order. What is the resulting height, and why?",
  "options": [
    "$O(\\\\log n)$, because BSTs always self-balance on insertion",
    "$O(n)$, because each new key becomes the sole right child of the previous maximum, forming a linked list",
    "$O(\\\\sqrt{n})$, because sorted input produces a balanced split at each level",
    "$O(1)$, because sorted insertion order allows constant-time placement"
  ],
  "correctAnswer": "$O(n)$, because each new key becomes the sole right child of the previous maximum, forming a linked list",
  "explanation": "Plain BSTs (unlike AVL/red-black trees) have no rebalancing step, so sorted-order insertion is the exact worst case: every new key is greater than all existing keys, so it's placed as the right child of the current maximum, producing a degenerate right-leaning chain of height $n-1$. The 'self-balance' distractor confuses BSTs with self-balancing variants; the $O(\\\\sqrt{n})$ option isn't a real complexity class for this problem; $O(1)$ ignores that insertion still requires a full root-to-leaf walk to find the insertion point."
}`;

export const FLASHCARD_WORKED_EXAMPLE = `EXAMPLE OF EXPECTED FLASHCARD QUALITY (illustrative — match this bar for active recall, not this topic):
{
  "front": "Why does inserting already-sorted data into a plain BST produce $O(n)$ height instead of $O(\\\\log n)$?",
  "back": "Because a plain BST has no rebalancing step — each sorted key is always greater than the current maximum, so it's always placed as a right child, producing a linked-list-shaped tree of height $n-1$.",
  "prompt_type": "QA",
  "retention_hint": "Picture a staircase, not a tree — sorted insertion into a plain BST builds stairs, one step down-right per key."
}`;

export const PRACTICE_TASK_WORKED_EXAMPLE = `EXAMPLE OF EXPECTED PRACTICE TASK QUALITY (illustrative — match this depth, not this topic):
{
  "task": "Insert the keys 5, 3, 8, 1, 4 (in that order) into an empty BST. Draw the resulting tree structure and state its height.",
  "difficulty": "medium",
  "solution": "**Step 1:** Insert 5 → becomes the root.\\n**Step 2:** Insert 3 → $3 < 5$, becomes left child of 5.\\n**Step 3:** Insert 8 → $8 > 5$, becomes right child of 5.\\n**Step 4:** Insert 1 → $1 < 5$, go left to 3; $1 < 3$, becomes left child of 3.\\n**Step 5:** Insert 4 → $4 < 5$, go left to 3; $4 > 3$, becomes right child of 3.\\n\\nResulting tree:\\n\`\`\`\\n      5\\n     / \\\\\\n    3   8\\n   / \\\\\\n  1   4\\n\`\`\`\\n**Height = 2** (root at level 0, leaves 1/4/8 at level... wait — 8 is at level 1, 1 and 4 are at level 2, so height is 2)."
}`;
