import { listCoordinators, createCoordinator, updateCoordinator, deleteCoordinator } from './_coordinators_common.js';
export const onRequestGet = listCoordinators;
export const onRequestPost = createCoordinator;
export const onRequestPatch = updateCoordinator;
export const onRequestDelete = deleteCoordinator;
