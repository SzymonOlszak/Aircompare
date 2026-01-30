export function runAdvectionDiffusion(grid: number [][], steps: number, u: number, v: number, dt: number, hx: number, hy: number, kappa: number) {
  let current = grid
  let t30!: number[][]
  let t60!: number[][]
  let t120: number[][]

  const y = grid.length;
  const x = grid[0].length;

  for (let t = 0; t < steps; t++) {
    const next = Array.from({ length: y }, () => Array(x).fill(0));

    for (let i = 1; i < y - 1; i++) {
      for (let j = 1; j < x - 1; j++) {
        next[i][j] = diffusionAdvection(current, i, j, u, v, dt, hx, hy, kappa);
      }
    }
    applyBoundsConditions(v, u, next, current, x, y);
    current = next;
    if (t == Math.floor(steps / 4)) {
      t30 = current
    }
    else if (t == Math.floor(steps / 2)) {
      t60 = current
    }
  }
  t120 = current
  return {t30, t60, t120};
}


export function diffusionAdvection(grid: number[][],i:number, j:number, u:number, v: number, dt:number, hx:number, hy: number, kappa: number) {
      const current = grid[i][j];

      //DLA X I Y
      let dCdx = 0
      let dCdy = 0
      if (u > 0) {  //E-W
        dCdx = (current - grid[i][j-1]) / (hx);
      } else {
        dCdx = (grid[i][j+1] - current) / (hx);
      }
      if (v > 0) {  //S-N
        dCdy = (current - grid[i-1][j]) / (hy);
      } else {
        dCdy = (grid[i+1][j] - current ) / (hy);
      }

      const advection = -(u * dCdx + v * dCdy);

      const diffusion =
        (grid[i+1][j] - 2*current + grid[i-1][j]) / hx**2 +
        (grid[i][j+1] - 2*current + grid[i][j-1]) / hy**2;
      return current + dt * (advection + kappa * diffusion);
}

function applyBoundsConditions(v: number, u: number, next: number [][], current: number [][], x: number, y: number) {
  if (v > 0) {   ///WIATR NA PÓŁNOC
        for (let j = 0; j < x; j++) {
          next[y - 1][j]     = next[y - 2][j];
          next[0][j] = current[0][j];
        }
      } else {   //WIATR NA POŁUDNIE
        for (let j = 0; j < x; j++) {
          next[0][j]     = next[1][j];
          next[y - 1][j] = current[y - 1][j];
        }
      }
      if (u > 0) {   //WIATR NA WSCHÓD
        for (let i = 0; i < y; i++) {
          next[i][x - 1] = next[i][x - 2];
          next[i][0]     = current[i][0]; // inflow
        }
      } else {   //WIATR NA ZACHÓD
        for (let i = 0; i < y; i++) {
          next[i][0] = next[i][1];
          next[i][x - 1] = current[i][x - 1];
        }
      }
}
export function getWindVector(direction: number, speed: number) {
  const radians = direction * Math.PI / 180;
  return {
    u: speed * Math.cos(radians),
    v: speed * Math.sin(radians)
  }
}

