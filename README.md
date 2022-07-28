# Anime Cartoonization

## Implementation

Couple of different implementations of processing:
- `public/index.html` & `src/anime.ts`  
  Using TFJS in browser  
  Processing using `@tensorflow/tfjs-backend-webgl`  
- `public/sockets.html` & `src/sockets.ts` client-side  
  `src/node.ts` server-side  
  Using WebSockets to send frame data to NodeJS backend for processing and receiving data back  
  Processing using `@tensorflow/tfjs-node-gpu` with CUDA acceleration  

## Screenshot

![Original](assets/me.jpg)
![Processed](assets/out.jpg)

# Credits

- Orignal: <https://github.com/SystemErrorWang/White-box-Cartoonization>
- Port: <https://github.com/PINTO0309/PINTO_model_zoo/tree/main/019_White-box-Cartoonization>
