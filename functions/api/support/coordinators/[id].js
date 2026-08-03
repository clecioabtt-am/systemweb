import { updateCoordinator, deleteCoordinator } from '../_coordinators_common.js';
export async function onRequestPatch(context){ return updateCoordinator({...context, routeId: context.params?.id}); }
export async function onRequestDelete(context){ return deleteCoordinator({...context, routeId: context.params?.id}); }
