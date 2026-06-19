## Hedge & Seek 
### Hedge Maze Generator & Designer

Hedge & Seek is a web application for generating and designing physical hedge mazes.

There are thousands of maze generators online, but very few are built with the layout constraints and aesthetics of actual hedge mazes in mind. This project bridges that gap and is influenced by the works of legendary maze designer Adrian Fisher.

#### Features
The core generation uses a modified recursive backtracking algorithm, tuned for physical living mazes:
* Corridor bias: Prefers straight paths to mimic formal garden designs.
* Braiding: Includes loops and alternative routes to prevent a single linear solution.
* Exit placement: Tries to position exits at natural dead-ends or corners.
* Endpoint selection uses breadth first search (BFS) distance ranking to produce long but varied paths.

#### Tech Stack
* Svelte
* daisyUI - Emerald Theme

#### Getting Started
To run the project locally:
1. Clone the repository.
2. Install the dependencies `npm install`
3. Run dev server `npm run dev`

#### License
This project is open source and available under the GNU General Public License v3.0 (GPLv3).

By Lewis Dryburgh, July 2026