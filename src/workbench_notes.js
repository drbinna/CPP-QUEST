// Line-by-line notes for Dr. Wheat's Bag files, used by the Workbench's Explain mode.
// Each note matches a line by a substring, resolved in order (so repeated lines like
// `return rc;` map to the right function). `link` points at lines in other files that
// this line connects to; they light up together.

const h = (m, text, link) => ({ file: "bag.h", m, text, link });
const c = (m, text, link) => ({ file: "bag.cpp", m, text, link });
const d = (m, text, link) => ({ file: "bagMain.cpp", m, text, link });
const k = (m, text, link) => ({ file: "Makefile", m, text, link });

export const FILE_INTRO = {
  "bag.h": "**The header.** Everything in this file is a promise, not a program: it tells the compiler what a `bag` looks like and what it can do, with zero lines of how. Read it top to bottom and you know the whole public face of the class.",
  "bag.cpp": "**The implementation.** Every promise the header made gets kept here, one function at a time, each one prefixed `bag::` so the compiler knows which class it belongs to. This file compiles once into `bag.o`.",
  "bagMain.cpp": "**The driver.** `main()` lives here. It makes bags, uses them, prints what it finds. On assignments Dr. Wheat writes this file and you write the class it calls, so learn to read a driver quickly.",
  "Makefile": "**The recipe.** When you type `make`, this file says what depends on what and which command rebuilds it. Make runs only the commands whose inputs are newer than their outputs. From P2 on you write this yourself.",
};

export const WALK_ORDER = ["bag.h", "bag.cpp", "bagMain.cpp", "Makefile"];

export const NOTES = [
  // ------------------------------------------------------------------ bag.h
  h("#ifndef __BAG_H", "**Include guard, part 1.** \"If `__BAG_H` is not yet defined, keep reading.\" The first time this header is pasted into a file, it isn't defined, so the class below gets read. Dr. Wheat names the symbol after the file: `__BAG_H` for bag.h.", [{ file: "bag.h", m: "#endif" }]),
  h("#define __BAG_H", "**Include guard, part 2.** Define the symbol, so if the same header gets included again in the same file (which happens constantly in bigger programs) the `#ifndef` above is false and the whole class is skipped instead of being declared twice."),
  h("// CSC 255 Spring 2026", "**File header comment.** Course, semester, instructor, then assignment and team. Required at the top of every `.h`, `.cpp` and Makefile. It's graded; make it a reflex."),
  h("//****", "**Separator line.** `//` plus 78 asterisks, exactly 80 characters. He puts one between every section of a file so the eye can find function boundaries. The 80 is also the line-length limit for everything."),
  h("class bag {", "**The class begins.** `bag` is now a type, like `int`, and the braces hold its members. Everything until the matching `};` describes what a bag is made of and what it can do.", [{ file: "bag.h", m: "};" }]),
  h("private:", "**Private section.** Members below this are visible only to the bag's own functions. The driver cannot touch `bagCount` directly; it has to go through `insert`, `remove`, `getBagCount`. That protection is the point of a class."),
  h("unsigned int bagCount;", "**How many things are in the bag right now.** `unsigned` because a count can't be negative. Starts at 0 in the constructor; `insert` raises it, `remove` lowers it.", [{ file: "bag.cpp", m: "bagCount = 0;" }, { file: "bag.cpp", m: "contents[bagCount++] = value;" }]),
  h("unsigned int bagCapacity;", "**How many things the bag *could* hold.** Fixed when the bag is built, never changes after. The difference between count and capacity is the free space.", [{ file: "bag.cpp", m: "this->bagCapacity = bagCapacity;" }]),
  h("int *contents;", "**A pointer to the storage.** Not an array; an 8-byte address of an array that the constructor will allocate somewhere else with `new`. The object holds the address; the integers live wherever the allocator put them. This is the two-block memory picture from the pointers lecture.", [{ file: "bag.cpp", m: "contents = new int[bagCapacity];" }, { file: "bag.cpp", m: "delete [] contents;" }]),
  h("public:", "**Public section.** Everything below is the interface: functions anyone holding a bag may call. The driver uses exactly these and nothing else."),
  h("bag(unsigned int bagCapacity = 100);", "**Constructor declaration.** Same name as the class, no return type. `= 100` is a default: `bag b;` means capacity 100, `bag b(1000);` means 1000. The default lives **here only**; the `.cpp` must not repeat it.", [{ file: "bag.cpp", m: "bag::bag(unsigned int bagCapacity) {" }, { file: "bagMain.cpp", m: "bag myBag1;" }, { file: "bagMain.cpp", m: "new bag(1000)" }]),
  h("~bag();", "**Destructor declaration.** The tilde marks it. Called automatically when a bag dies (end of scope, or `delete`). Its job is to free the array the constructor allocated.", [{ file: "bag.cpp", m: "bag::~bag() {" }, { file: "bagMain.cpp", m: "delete myBag3;" }]),
  h("// to insert a value into the bag;", "**Comment describing the contract.** What goes in, what comes back, and what true/false mean. Notice it explains the *why* of the return value, not what the code does line by line."),
  h("bool insert(int value);", "**Insert, declared.** Takes an int, returns `bool`: true if it fit, false if the bag was full. Returning success instead of silently failing is his house style.", [{ file: "bag.cpp", m: "bool bag::insert(int value) {" }, { file: "bagMain.cpp", m: "myBag1.insert(15);" }]),
  h("bool remove(int value);", "**Remove, declared.** Finds one copy of `value` and takes it out; true if found, false if not.", [{ file: "bag.cpp", m: "bool bag::remove(int value) {" }, { file: "bagMain.cpp", m: "myBag1.remove(7);" }]),
  h("void clear();", "**Clear, declared.** Empties the bag. Returns nothing because it can't fail.", [{ file: "bag.cpp", m: "void bag::clear() {" }]),
  h("// the constant functions", "**A label for what follows.** The next three functions only *read* the bag, so they're marked `const`. Grouping them with a comment is part of his style."),
  h("bool isPresent(int value) const;", "**Is it in the bag?** The trailing `const` is a promise: this function will not change any member variable. The compiler enforces it. Every function that can be `const` must be, on every assignment.", [{ file: "bag.cpp", m: "bool bag::isPresent(int value) const {" }, { file: "bagMain.cpp", m: "myBag1.isPresent(7)" }]),
  h("unsigned int getBagCount() const;", "**Getter for the count.** The driver can't read the private `bagCount`, so this hands the number out. `const` because reading doesn't change anything.", [{ file: "bag.cpp", m: "unsigned int bag::getBagCount() const {" }, { file: "bagMain.cpp", m: "myBag1.getBagCount()" }]),
  h("unsigned int getBagCapacity() const;", "**Getter for the capacity.** Same idea.", [{ file: "bag.cpp", m: "unsigned int bag::getBagCapacity() const {" }, { file: "bagMain.cpp", m: "myBag2->getBagCapacity()" }]),
  h("};", "**The class ends.** The semicolon after the brace is required and is the most common compile error in week one.", [{ file: "bag.h", m: "class bag {" }]),
  h("#endif", "**Include guard, part 3.** Closes the `#ifndef` at the top. Everything between the two is included once per file, no matter how many times the header gets pulled in.", [{ file: "bag.h", m: "#ifndef __BAG_H" }]),

  // ---------------------------------------------------------------- bag.cpp
  c("#include <cstdio>", "**Standard library include.** Angle brackets mean \"look in the system's include folders\". `cstdio` is C's printf family; he includes it by habit even when unused."),
  c("#include <iostream>", "**Brings in `cout` and `cerr`.** Needed for any printing. Also where his commented-out debug prints come from."),
  c("#include \"bag.h\"", "**Paste the header in here.** Quotes mean \"look in this directory first\". At compile time the preprocessor replaces this line with the full text of bag.h, which is how this file knows what `bagCount`, `contents` and `bag` are.", [{ file: "bag.h", m: "class bag {" }, { file: "Makefile", m: "bag.o: bag.cpp bag.h" }]),
  c("using namespace std;", "**Saves typing `std::`.** Without it you'd write `std::cout`. Fine in a small program; he uses it everywhere."),
  c("bag::bag(unsigned int bagCapacity) {", "**Constructor definition.** `bag::` says \"the bag class's\" and the second `bag` is the function. No return type, matching the header. The `= 100` is **not** repeated here; that would be an error.", [{ file: "bag.h", m: "bag(unsigned int bagCapacity = 100);" }]),
  c("bagCount = 0;", "**A new bag is empty.** Set the count before anything else can read it. Member variables start with garbage unless you set them.", [{ file: "bag.h", m: "unsigned int bagCount;" }]),
  c("this->bagCapacity = bagCapacity;", "**The parameter shadows the member.** Both are named `bagCapacity`, so plain `bagCapacity` means the parameter. `this->bagCapacity` means \"the one inside this object\". Left side: member. Right side: parameter. He prefers this to renaming the parameter.", [{ file: "bag.h", m: "unsigned int bagCapacity;" }]),
  c("contents = new int[bagCapacity];", "**Allocate the storage.** `new int[n]` asks the heap for n integers (4 bytes each) and returns the address of the first one. That address is stored in `contents`. From now on the object and its array are two separate blocks joined by this pointer.", [{ file: "bag.h", m: "int *contents;" }, { file: "bag.cpp", m: "delete [] contents;" }]),
  c("bag::~bag() {", "**Destructor definition.** Runs automatically when the bag is destroyed. The default destructor would free the 16-byte object but knows nothing about the array; that's our job.", [{ file: "bag.h", m: "~bag();" }]),
  c("if (contents != NULL) {", "**Only free what exists.** Defensive: if the pointer is already null there's nothing to give back. `NULL` is address zero, the conventional \"points at nothing\"."),
  c("delete [] contents;", "**Give the array back.** `delete []` (with the brackets) because it was made with `new []`. Skip this and every bag that dies leaks its array forever: a memory leak. Ten ints is nothing; a million bags is the machine running out of memory.", [{ file: "bag.cpp", m: "contents = new int[bagCapacity];" }]),
  c("contents = NULL;", "**Don't leave a dangling pointer.** After `delete` the address is invalid; setting it to NULL means any accidental later use fails loudly instead of corrupting memory."),
  c("bool bag::insert(int value) {", "**Insert definition.** Matches the header's prototype exactly: same return type, same parameter.", [{ file: "bag.h", m: "bool insert(int value);" }]),
  c("bool rc = (bagCount < bagCapacity);", "**Decide first, act second.** `rc` (return code) is true when there's room. He computes the answer into a variable rather than branching and returning in two places; one `return` at the bottom."),
  c("if (rc) {", "**Only insert if there's room.**"),
  c("contents[bagCount++] = value;", "**Store it, then count it.** `contents[bagCount]` is the first free slot (slots 0..count-1 are used). Post-increment: use the old `bagCount` as the index, *then* add one. One line does both.", [{ file: "bag.h", m: "unsigned int bagCount;" }]),
  c("return rc;", "**Report what happened.** The caller can check `if (myBag.insert(x))` if it cares. This is the return-code pattern: `bool rc = ...; if (rc) {...} return rc;`."),
  c("bool bag::remove(int value) {", "**Remove definition.** Find one copy of `value` and take it out.", [{ file: "bag.h", m: "bool remove(int value);" }]),
  c("bool rc = false;", "**Assume not found** until the loop proves otherwise."),
  c("for (unsigned int i = 0; i < bagCount; i++) {", "**Walk the used slots.** Only up to `bagCount`, not `bagCapacity`: slots past the count are garbage. `unsigned int i` to match `bagCount`, so the compiler doesn't warn about comparing signed with unsigned."),
  c("if (contents[i] == value) {", "**Is this the one?** `contents[i]` is the same as `*(contents + i)`: start at the address in `contents`, step i integers (i × 4 bytes) forward, read."),
  c("rc = true;", "**Found it.** Flip the return code."),
  c("contents[i] = contents[--bagCount];", "**The trick.** Don't shift everything left. A bag has no order, so overwrite the found slot with the *last* element and shrink the count. Pre-decrement: subtract one *first*, then use it as the index, so `--bagCount` is exactly the last used slot. O(1) removal. A List can't do this, because a List has an order.", [{ file: "bag.h", m: "unsigned int bagCount;" }]),
  c("break;", "**Stop looking.** Removing one copy is the contract; keep looping and you might remove more, and `i` would now be looking at an element it already skipped."),
  c("void bag::clear() {", "**Clear definition.**", [{ file: "bag.h", m: "void clear();" }]),
  c("bagCount = 0;", "**That's all it takes.** The integers are still sitting in the array, but with the count at zero nothing will ever read them, and the next insert overwrites slot 0. Nothing is freed; the array is reused."),
  c("bool bag::isPresent(int value) const {", "**isPresent definition.** The `const` must appear here too, or the compiler says this is a different function from the one declared.", [{ file: "bag.h", m: "bool isPresent(int value) const;" }]),
  c("rc = true;", "**Found it.**"),
  c("break;", "**Stop looking.** No need to scan the rest once the answer is yes."),
  c("unsigned int bag::getBagCount() const {", "**Getter definition.** A one-line window onto a private variable.", [{ file: "bag.h", m: "unsigned int getBagCount() const;" }]),
  c("return bagCount;", "**Hand the number out.** The caller gets a copy; they can't change the real one through it."),
  c("unsigned int bag::getBagCapacity() const {", "**Getter definition.**", [{ file: "bag.h", m: "unsigned int getBagCapacity() const;" }]),
  c("return bagCapacity;", "**Hand the capacity out.**"),

  // ------------------------------------------------------------ bagMain.cpp
  d("// CSC 255 Spring 2026", "**File header comment**, same as the other files. On assignments he writes this file, so his name is on it."),
  d("#include <iostream>", "**For `cout`.**"),
  d("#include \"bag.h\"", "**The driver sees the blueprint, not the engine.** This pastes in bag.h, so `main` knows a bag exists and what it can do, without ever seeing bag.cpp. The two meet only at link time, when make joins bagMain.o and bag.o.", [{ file: "bag.h", m: "class bag {" }, { file: "Makefile", m: "g++ $(CWFLAGS) bagMain.o bag.o -o bag" }]),
  d("using namespace std;", "**Saves typing `std::cout`.**"),
  d("int main() {", "**Where the program starts.** Exactly one `main` in the whole program, and it's here, never in bag.cpp."),
  d("bag myBag1;", "**A bag on the stack.** No `new`: the object lives in `main`'s own memory and is destroyed automatically when `main` ends, which runs the destructor for you. Capacity 100 from the header's default.", [{ file: "bag.h", m: "bag(unsigned int bagCapacity = 100);" }, { file: "bag.cpp", m: "bag::bag(unsigned int bagCapacity) {" }]),
  d("bag *myBag2 = new bag(1000);", "**A bag on the heap.** `new bag(1000)` builds one with capacity 1000 and returns its address; `myBag2` is a pointer holding that address. Heap objects are **your** responsibility: nothing frees them unless you `delete`.", [{ file: "bag.cpp", m: "bag::bag(unsigned int bagCapacity) {" }, { file: "bagMain.cpp", m: "delete myBag2;" }]),
  d("bag *myBag3 = new bag();", "**Another heap bag**, using the default capacity. `new bag()` and `new bag` mean the same thing.", [{ file: "bagMain.cpp", m: "delete myBag3;" }]),
  d("myBag1.insert(15);", "**Call a member function on a stack object.** Dot syntax. Inside `insert`, `this` points at `myBag1`, so `bagCount` means myBag1's count. Returns true (there was room) but the driver ignores it.", [{ file: "bag.cpp", m: "bool bag::insert(int value) {" }, { file: "bag.h", m: "bool insert(int value);" }]),
  d("myBag1.insert(7);", "**Second insert.** Goes into slot 1."),
  d("myBag1.insert(23);", "**Third insert.** Slot 2. Count is now 3."),
  d("myBag1.remove(7);", "**Remove the 7.** It's in slot 1; `remove` overwrites slot 1 with the last element (23) and drops the count to 2. The bag is now {15, 23} in that order.", [{ file: "bag.cpp", m: "contents[i] = contents[--bagCount];" }]),
  d("cout << \"myBag1 holds \"", "**Print the count and capacity.** `<<` chains: each piece is sent to `cout` in order. The getters are the only way the driver can see the private numbers.", [{ file: "bag.cpp", m: "unsigned int bag::getBagCount() const {" }]),
  d("<< myBag1.getBagCapacity() << endl;", "**Continuation of the same statement.** `endl` prints a newline. Splitting a long `cout` across two lines keeps it under 80 columns."),
  d("cout << \"is 7 present?", "**Ask the bag.** `isPresent(7)` returns false now (we removed it). The `? :` picks \"yes\" or \"no\" from that bool.", [{ file: "bag.cpp", m: "bool bag::isPresent(int value) const {" }]),
  d("cout << \"is 23 present?", "**Same question, different answer.** 23 is still there, in slot 1 after the remove."),
  d("cout << \"myBag2 capacity", "**Arrow, not dot.** `myBag2` is a pointer, so you reach the object with `->`. `myBag2->getBagCapacity()` is short for `(*myBag2).getBagCapacity()`.", [{ file: "bagMain.cpp", m: "bag *myBag2 = new bag(1000);" }]),
  d("delete myBag3;", "**Free a heap bag.** This runs bag's destructor (which frees the array), then frees the object itself. Every `new` needs a matching `delete`.", [{ file: "bag.cpp", m: "bag::~bag() {" }, { file: "bagMain.cpp", m: "bag *myBag3 = new bag();" }]),
  d("delete myBag2;", "**And the other one.** In his original demo he deleted only myBag3, which leaks myBag2. Added here so the program is clean.", [{ file: "bagMain.cpp", m: "bag *myBag2 = new bag(1000);" }]),
  d("return 0;", "**Zero means success** to the shell. `myBag1` is destroyed right after this line, automatically, because it was on the stack."),

  // ---------------------------------------------------------------- Makefile
  k("# CSC 255 Spring 2026", "**File header comment**, Makefile flavour: `#` instead of `//`. Still required."),
  k("CWFLAGS=-Wall -Wextra -O2", "**A variable holding the compiler flags.** `-Wall -Wextra` turn on all the useful warnings (your code must compile with none); `-O2` optimises. Written once here, used as `$(CWFLAGS)` below, so changing flags is a one-line edit.", [{ file: "Makefile", m: "g++ $(CWFLAGS) -c bag.cpp" }]),
  k("all: bag", "**The default target.** `make` with no arguments builds the *first* rule in the file. `all` has no command of its own; it just depends on `bag`, so building `all` means building `bag`.", [{ file: "Makefile", m: "bag: bagMain.o bag.o" }]),
  k("bag.o: bag.cpp bag.h", "**A rule: target, colon, dependencies.** `bag.o` must be rebuilt if `bag.cpp` *or* `bag.h` is newer than it. Listing the header is the part people forget, and it's why `touch bag.h` recompiles this file.", [{ file: "bag.cpp", m: "#include \"bag.h\"" }]),
  k("g++ $(CWFLAGS) -c bag.cpp", "**The command for that rule.** Must start with a real TAB, not spaces. `-c` means compile only, don't link: the output is `bag.o`, an object file with the compiled functions but no `main`.", [{ file: "Makefile", m: "CWFLAGS=-Wall -Wextra -O2" }]),
  k("bagMain.o: bagMain.cpp bag.h", "**Same shape for the driver.** It also includes bag.h, so it also depends on it.", [{ file: "bagMain.cpp", m: "#include \"bag.h\"" }]),
  k("g++ $(CWFLAGS) -c bagMain.cpp", "**Compile the driver on its own.** Produces `bagMain.o`, which has `main` but only *references* to the bag functions; they get resolved at link time."),
  k("bag: bagMain.o bag.o", "**The link rule.** The executable depends on both object files. If either is newer than `bag`, relink. Note no `.cpp` here: by this point the sources have already been compiled.", [{ file: "Makefile", m: "all: bag" }]),
  k("g++ $(CWFLAGS) bagMain.o bag.o -o bag", "**Link.** No `-c`, so g++ joins the object files, matching every call in bagMain.o to its definition in bag.o, and writes the program to `bag` (`-o` names the output). An \"undefined reference\" error here means a function was declared and called but never defined.", [{ file: "bagMain.cpp", m: "myBag1.insert(15);" }, { file: "bag.cpp", m: "bool bag::insert(int value) {" }]),
  k("clean:", "**A rule with no dependencies.** `make clean` always runs its command. It's the standard name for \"delete the build products so the next make starts from scratch\"."),
  k("rm -f *.o bag.exe bag", "**Remove every object file and the executable.** `-f` means don't complain if they're missing. `bag.exe` is there because he builds on Windows under Cygwin, where executables get `.exe`."),
];
