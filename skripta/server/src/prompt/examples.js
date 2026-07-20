// Worked examples shown to the model so it can see the exact bar its own
// output must clear — one per section type that's hardest to get right
// without a concrete reference (subtle distractors, genuine step-by-step
// derivations, active-recall phrasing).

export const CHAPTER_WORKED_EXAMPLE = `EXAMPLE OF EXPECTED CHAPTER DEPTH (illustrative — match this depth/style, not this topic). This example happens to be a programming topic so it also shows a populated "code_examples" entry — remember that field is [] for every non-programming chapter (see CODE EXAMPLES rule):
{
  "title": "Binary Search Trees: Insertion and Balance",
  "key_idea": "A BST is only fast if it stays balanced — the same insert operation that's $O(\\\\log n)$ on random data degrades to $O(n)$ on sorted data.",
  "description": "A **binary search tree (BST)** maintains the invariant that for any node, every key in its left subtree is smaller and every key in its right subtree is larger...\\n\\n### Insertion Mechanics\\nInserting a new key means walking from the root...\\n\\n\`\`\`concept\\nThe BST invariant must hold at every single node, not just the root — this is what makes search $O(h)$ where $h$ is tree height.\\n\`\`\`\\n\\n...(continues for 200-450 words total)...",
  "easy_explanation": "Think of a BST like a game of \\"guess my number, higher or lower\\" — every guess (node) tells you to look only at the smaller half or the larger half next, so you never have to check the whole list.",
  "advanced_explanation": "Self-balancing variants (AVL, Red-Black trees) fix the sorted-input worst case by performing rotations after each insert, keeping height within a constant factor of $\\\\log_2 n$ at the cost of extra bookkeeping per write — a tradeoff plain BSTs don't make.",
  "real_world_analogy": "Like a well-organized filing cabinet where folders are always in alphabetical order — you can jump straight to roughly the right drawer instead of checking every folder from the front.",
  "memory_trick": "\\"Left is Less\\" — the left child is always the smaller key, which is the entire invariant in three words.",
  "common_mistakes": ["Assuming a plain BST is always $O(\\\\log n)$ — it only holds for balanced trees, not worst-case input order.", "Forgetting that in-order traversal of a BST always yields sorted output — a fact often tested directly."],
  "exam_tip": "Expect a question asking you to trace an insertion sequence and state the resulting height, or to identify why sorted input is the worst case — both are extremely common.",
  "key_points": ["Insertion always creates a new leaf", "Search, insert, and delete are all $O(h)$", "An unbalanced BST degrades to $O(n)$ — a sorted-order insertion sequence produces a linked list"],
  "formulas": [{"formula": "h \\\\geq \\\\lceil \\\\log_2(n+1) \\\\rceil - 1", "when_to_use": "Establishing the theoretical minimum height for a BST with $n$ nodes, used to argue why balance matters.", "example": "For $n = 15$ nodes: $h \\\\geq \\\\lceil \\\\log_2(16) \\\\rceil - 1 = \\\\lceil 4 \\\\rceil - 1 = 3$. A perfectly balanced 15-node tree has height 3; a degenerate (linked-list) insertion order instead gives height 14."}],
  "diagrams_or_tables_explained": [],
  "code_examples": [
    {
      "language": "python",
      "title": "Recursive BST insertion",
      "code": "def insert(root, key):\\n    if root is None:\\n        return Node(key)\\n    if key < root.key:\\n        root.left = insert(root.left, key)\\n    else:\\n        root.right = insert(root.right, key)\\n    return root",
      "line_explanations": [
        {"line": "if root is None: return Node(key)", "explanation": "Base case — an empty subtree is exactly where the new key belongs, so a new leaf node is created here."},
        {"line": "if key < root.key: root.left = insert(root.left, key)", "explanation": "The BST invariant routes smaller keys left; the recursive call walks one level deeper and reattaches the (possibly modified) subtree."},
        {"line": "return root", "explanation": "Every call returns the (unchanged or newly-created) subtree root, which is how the recursive reattachment on the line above works."}
      ],
      "common_mistakes": ["Forgetting to reattach the return value (\\\`root.left = insert(...)\\\`) and instead calling \\\`insert(root.left, key)\\\` with no assignment, which silently drops the new node."],
      "time_complexity": "$O(h)$ where $h$ is tree height — $O(\\\\log n)$ balanced, $O(n)$ worst case",
      "space_complexity": "$O(h)$ for the recursion call stack",
      "alternative_solution": "An iterative version using a \\\`while\\\` loop avoids the $O(h)$ call-stack space at the cost of slightly less readable pointer-following logic — same time complexity either way.",
      "expected_output": null
    }
  ],
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
